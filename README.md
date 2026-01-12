# STAC Search Viewer

**[English](README.md)** | **[中文](README_ZH.md)**

A web platform for searching and visualizing STAC (SpatioTemporal Asset Catalog) items using OpenLayers. This project provides an intuitive map interface that allows users to easily search, browse and analyze various satellite imagery data.

## Features

- 🗺️ **Interactive Map Interface**: Built with OpenLayers for smooth map interactions
- 🔍 **Advanced Search**: Search STAC items by collection, date range, and bounding box
- 📍 **Draw on Map**: Draw bounding boxes directly on the map for spatial queries
- 📊 **Detailed Information**: View comprehensive item details in a modal window
- ⬇️ **Item Download**: Download item assets directly from Item Details (supports Planetary Computer signing and basic S3 handling)
- 🛰️ **Sentinel-1 Full Product Download**: Download complete Sentinel-1 products as ZIP files from Copernicus Data Space (opens in new tab for browser-based authentication)
- 🌐 **Multiple Data Providers**: Support for Microsoft Planetary Computer, AWS Earth Search, and Copernicus Data Space

## Project Structure

```
stacsearch/
├── index.html                    # Entry HTML file
├── package.json                  # Project dependencies
├── vite.config.mjs               # Vite configuration
├── .env.example                  # Environment variables template
│
├── src/                          # Source code directory
│   ├── main.js                   # Application entry point
│   │
│   ├── api/                      # API clients
│   │   ├── copernicus-client.js  # Copernicus Data Space client
│   │   ├── download-clients.js   # Download clients
│   │   └── stac-service.js       # STAC API service
│   │
│   ├── basemaps/                 # Basemap configurations
│   │   ├── esri.js               # Esri basemaps
│   │   ├── google.js             # Google basemaps
│   │   ├── osm.js                # OpenStreetMap
│   │   └── tianditu.js           # Tianditu (China)
│   │
│   ├── config/                   # Configuration files
│   │   └── index.js              # App configuration
│   │
│   ├── managers/                 # Feature managers
│   │   ├── index.js              # Unified exports
│   │   ├── CollectionPicker.js   # Collection picker UI
│   │   ├── DrawingManager.js     # Map drawing tools
│   │   ├── MapManager.js         # Map initialization & layers
│   │   ├── SearchManager.js      # STAC search logic
│   │   └── UIController.js       # UI event handling
│   │
│   ├── styles/                   # Stylesheets
│   │   └── main.css              # Main styles
│   │
│   ├── types/                    # Type definitions
│   │   └── index.js              # JSDoc type definitions
│   │
│   └── utils/                    # Utility functions
│       └── index.js              # Helper functions
│
└── dist/                         # Build output
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Junhao2314/stac-search-viewer.git
cd stac-search-viewer
```

2. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (default Vite port).

### Build for Production

Build the project:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Usage

1. **Select a Provider**: Choose a STAC data provider from the dropdown (e.g., Microsoft Planetary Computer, AWS Earth Search, Copernicus Data Space)
2. **Choose a Collection**: Click "Select Collection" to browse and select a satellite imagery collection
3. **Set Date Range**: Specify the time period for your search
4. **Define Area of Interest**: 
   - Draw a rectangle or polygon on the map using the drawing tools
   - Or manually enter bounding box coordinates
5. **Search**: Click the "Search" button to find matching items
6. **Browse Results**: View search results in the sidebar, hover to highlight on map
7. **View Details**: Click on any result to see detailed information and download assets

## Environment Variables

For full functionality, you can configure the following environment variables. Create a `.env` file based on `.env.example`:

### Copernicus Data Space (Sentinel-1 Full Product Download)

Sentinel-1 full product downloads require authentication with Copernicus Data Space. Set your credentials at runtime in the browser console before downloading:

```javascript
window.COPERNICUS_USERNAME = 'your_username';
window.COPERNICUS_PASSWORD = 'your_password';
```

To create an account, register at [https://dataspace.copernicus.eu/](https://dataspace.copernicus.eu/)

Note: For security reasons, Copernicus credentials are only accepted via runtime injection to prevent them from being bundled into static assets.

If credentials are not preconfigured, the Copernicus download dialog also provides a small runtime-only form where you can enter the username and password directly. These values are applied to `window.COPERNICUS_USERNAME` / `window.COPERNICUS_PASSWORD` for the current browser session only and are never persisted to disk.

GitHub Pages: The included workflow can generate `dist/runtime-config.js` from GitHub repository secrets (`VITE_COPERNICUS_USERNAME`, `VITE_COPERNICUS_PASSWORD`) to prefill credentials at runtime. Security warning: on a public GitHub Pages site, these values are still visible to visitors in the deployed files.

### Optional Environment Variables

- `VITE_PC_SUBSCRIPTION_KEY`: Microsoft Planetary Computer subscription key for higher rate limits
- `VITE_S3_REQUESTER_PAYS`: Set to `true` for requester-pays S3 buckets
- `VITE_GOOGLE_TILE_URL`: Custom Google Maps tile URL
- `VITE_GOOGLE_SUBDOMAINS`: Google tile service subdomains (default: `mt0,mt1,mt2,mt3`)

## Notice

- This project is intended for research and educational use only.
- Commercial use is prohibited.
- Do not use this project in violation of laws and regulations or to infringe upon the lawful rights and interests of others.
- Use at your own risk; the author/maintainers are not liable for any direct or indirect losses.
- For commercial licensing or other uses, please contact the author.
