# PrintKit MCP Server

An [MCP](https://modelcontextprotocol.io) server that gives AI agents the ability to print real photo products — metal prints, wood prints, gallery frames, photo magnets, and more — through [PrintKit](https://printkit.dev).

One conversation. Real prints. Shipped from a US lab.

## What it does

Four tools that cover the full print ordering flow:

| Tool | Description |
|------|-------------|
| `printkit_list_products` | Browse the full product catalog — titles, sizes, price ranges, photos |
| `printkit_get_product` | Get detailed product info — every variant with SKU, price, and image specs |
| `printkit_upload_photo` | Upload a local image file, get back a hosted URL ready for printing |
| `printkit_create_order` | Submit an order and get a checkout URL — opens in the browser automatically |

No API key required. No account needed. Works out of the box.

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "printkit": {
      "command": "node",
      "args": ["/path/to/printkit-mcp/src/index.js"]
    }
  }
}
```

### Install from source

```bash
git clone https://github.com/pushplace/printkit-mcp.git
cd printkit-mcp
npm install
```

## Usage

Once connected, your agent can print photos through natural conversation:

> "Print this photo as an 8x10 metal print"

The agent will:
1. Upload the image to PrintKit's CDN
2. Look up the right SKU from the product catalog
3. Create the order
4. Open the checkout URL in your browser

You review the order, pay, and a real print ships to your door.

## Example flow

```
You: Print /Users/me/photos/sunset.jpg as a wood print, 16x20

Agent: [calls printkit_upload_photo] → gets hosted URL
Agent: [calls printkit_get_product handle="wood-prints"] → finds SKU "wood-print-16x20" at $118
Agent: [calls printkit_create_order sku="wood-print-16x20"] → opens checkout

"Order created! Opening checkout in your browser."
```

## Products

Metal prints, wood prints, gallery frames, acrylic blocks, large format prints, photo magazines, photo magnets, greeting cards, postcards, and photo stickers. 10 products, 100+ size variants.

Full catalog: [printkit.dev/products.json](https://printkit.dev/products.json)

## How it works

PrintKit is a print API built by [Social Print Studio](https://socialprintstudio.com) — a professional photo printing lab that's been shipping products since 2012. This MCP server wraps PrintKit's REST API so any MCP-compatible agent can order prints.

- No auth required (optional API key enables order tracking and commission)
- Photos are uploaded to S3 via presigned URLs
- Orders go through Shopify checkout — customer pays, SPS prints and ships
- All printing done in-house at a US lab with archival inks

## Links

- [PrintKit](https://printkit.dev) — the print API
- [API docs](https://printkit.dev/docs) — full documentation
- [LLM context](https://printkit.dev/llms-full.txt) — machine-readable API spec
- [Product catalog](https://printkit.dev/products.json) — all products as JSON

## License

MIT
