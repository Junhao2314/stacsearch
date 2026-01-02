# STAC Search Viewer

**[English](README.md)** | **[中文](README_ZH.md)**

A web platform for searching and visualizing STAC (SpatioTemporal Asset Catalog) items using OpenLayers. This project provides an intuitive map interface that allows users to easily search, browse and analyze various satellite imagery data.

## Features

- 🗺️ **Interactive Map Interface**: Built with OpenLayers for smooth map interactions
- 🔍 **Advanced Search**: Search STAC items by collection, date range, and bounding box
- 📍 **Draw on Map**: Draw bounding boxes directly on the map for spatial queries
- 📊 **Detailed Information**: View comprehensive item details in a modal window
- ⬇️ **Item Download**: Download item assets directly from Item Details (supports Planetary Computer signing and basic S3 handling)

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

1. **Select a Provider**: Choose a STAC data provider from the dropdown (e.g., Microsoft Planetary Computer, AWS Earth Search)
2. **Choose a Collection**: Click "Select Collection" to browse and select a satellite imagery collection
3. **Set Date Range**: Specify the time period for your search
4. **Define Area of Interest**: 
   - Draw a rectangle or polygon on the map using the drawing tools
   - Or manually enter bounding box coordinates
5. **Search**: Click the "Search" button to find matching items
6. **Browse Results**: View search results in the sidebar, hover to highlight on map
7. **View Details**: Click on any result to see detailed information and download assets

## Notice

- This project is intended for research and educational use only.
- Commercial use is prohibited.
- Do not use this project in violation of laws and regulations or to infringe upon the lawful rights and interests of others.
- Use at your own risk; the author/maintainers are not liable for any direct or indirect losses.
- For commercial licensing or other uses, please contact the author.
