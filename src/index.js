#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const PRINTKIT_BASE = "https://printkit.dev";

const server = new McpServer({
  name: "printkit",
  version: "0.1.0",
});

// --- Tool 1: List products ---
server.tool(
  "printkit_list_products",
  "Browse the PrintKit product catalog. Returns all available products with titles, descriptions, sizes, price ranges, and product photos.",
  {},
  async () => {
    const res = await fetch(`${PRINTKIT_BASE}/products.json`);
    if (!res.ok) {
      return { content: [{ type: "text", text: `Error fetching catalog: ${res.status}` }], isError: true };
    }
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- Tool 2: Get product details ---
server.tool(
  "printkit_get_product",
  "Get detailed product info including all variants with SKUs, sizes, prices, and image constraints.",
  {
    handle: z.string().describe('Product handle, e.g. "gallery-frames", "large-format-prints", "wood-prints", "metal-prints", "acrylic-photo-block", "photo-magazine"'),
  },
  async ({ handle }) => {
    const res = await fetch(`${PRINTKIT_BASE}/products/${handle}.json`);
    if (!res.ok) {
      return { content: [{ type: "text", text: `Error fetching product: ${res.status}` }], isError: true };
    }
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- Tool 3: Upload photo ---
server.tool(
  "printkit_upload_photo",
  "Upload a photo file to PrintKit for printing. Returns the public URL to use when creating an order.",
  {
    file_path: z.string().describe("Absolute path to the image file on disk"),
    content_type: z.string().optional().describe('MIME type, e.g. "image/jpeg" or "image/png". Auto-detected from extension if omitted.'),
  },
  async ({ file_path, content_type }) => {
    // Auto-detect content type from extension
    if (!content_type) {
      const ext = path.extname(file_path).toLowerCase();
      const types = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".heic": "image/heic" };
      content_type = types[ext] || "image/jpeg";
    }

    // Check file exists
    if (!fs.existsSync(file_path)) {
      return { content: [{ type: "text", text: `File not found: ${file_path}` }], isError: true };
    }

    // Step 1: Get presigned upload URL
    const presignRes = await fetch(`${PRINTKIT_BASE}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: content_type,
        filename: path.basename(file_path),
        source: "printkit-mcp",
      }),
    });

    if (!presignRes.ok) {
      const err = await presignRes.text();
      return { content: [{ type: "text", text: `Upload presign failed: ${err}` }], isError: true };
    }

    const presignData = await presignRes.json();
    if (!presignData.uploadUrl) {
      return { content: [{ type: "text", text: "Error: No upload URL returned from PrintKit" }], isError: true };
    }

    // Step 2: PUT file to S3
    const fileBuffer = fs.readFileSync(file_path);
    const uploadRes = await fetch(presignData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": content_type },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      return { content: [{ type: "text", text: `S3 upload failed: ${uploadRes.status}` }], isError: true };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          publicUrl: presignData.publicUrl,
          message: "Photo uploaded successfully",
        }),
      }],
    };
  }
);

// --- Tool 4: Create order ---
server.tool(
  "printkit_create_order",
  "Create an order with uploaded photos and get a Shopify checkout URL. The user clicks the URL to complete their purchase.",
  {
    sku: z.string().describe("Product variant SKU from the product catalog"),
    photo_urls: z.array(z.string()).describe("Array of photo URLs returned from printkit_upload_photo"),
    properties: z.record(z.string()).optional().describe("Optional line item properties (e.g. project name, personalization)"),
  },
  async ({ sku, photo_urls, properties = {} }) => {
    const res = await fetch(`${PRINTKIT_BASE}/api/add-to-cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        source: "printkit-mcp",
        projectData: { photos: photo_urls },
        properties,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { content: [{ type: "text", text: `Order creation failed: ${err}` }], isError: true };
    }

    const data = await res.json();

    if (data.success && data.redirectUrl) {
      // Auto-open checkout in browser
      const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${openCmd} "${data.redirectUrl}"`);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            checkoutUrl: data.redirectUrl,
            message: "Order created! Opening checkout in your browser.",
          }),
        }],
      };
    } else {
      return {
        content: [{ type: "text", text: `Order failed: ${data.error || "Unknown error"}` }],
        isError: true,
      };
    }
  }
);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
