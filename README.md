# Transcript Annotation Tool

A comprehensive web application for annotating and analyzing classroom transcripts with educational features and teacher-student discourse analysis.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [File Formats](#file-formats)
- [Google Cloud Integration](#google-cloud-integration)
- [API Documentation](#api-documentation)
- [Technical Architecture](#technical-architecture)
- [Troubleshooting](#troubleshooting)

## Overview

This tool is designed for educational researchers and teachers to analyze classroom discourse through transcript annotation. It supports multiple annotation frameworks, comparison with expert annotations and LLM analysis, and provides comprehensive visualization of teaching and learning patterns.

### Key Capabilities

- **Transcript Annotation**: Annotate classroom transcripts with educational discourse features
- **Multi-Framework Support**: Support for Conceptual, Discursive, Talk, and Lexical annotation categories
- **Expert Comparison**: Compare annotations with expert ratings and LLM analysis
- **Cloud Integration**: Upload and sync annotations to Google Cloud Storage
- **Bulk Operations**: Upload multiple transcripts and manage them efficiently
- **Advanced Filtering**: Filter by speakers, segments, and lesson components

## Features

### 🎯 Core Annotation Features

- **Real-time Annotation**: Click-to-annotate interface with instant visual feedback
- **Feature Definitions**: Comprehensive definitions with examples and non-examples
- **Learning Goal Notes**: Create and manage pedagogical observation notes
- **Row Selection**: Multi-select transcript rows for detailed analysis
- **Color-coded Speakers**: Automatic speaker identification with visual color coding

### 📊 Analysis & Comparison

- **Expert Comparison**: Side-by-side comparison with expert annotations
- **LLM Analysis**: Integration with AI analysis for transcript insights
- **Unified Comparison**: Compare your annotations with multiple expert sources
- **Statistical Reports**: Generate comprehensive annotation statistics

### 🔄 Data Management

- **Transcript Upload**: Drag-and-drop Excel file upload for new transcripts
- **Bulk Upload**: Upload multiple transcripts simultaneously via ZIP files
- **Cloud Sync**: Automatic synchronization with Google Cloud Storage
- **Export Functions**: Export annotations in multiple formats (XLSX, CSV)

### 🎛️ User Interface

- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Advanced Filtering**: Filter by speakers (students, teachers, individuals) and lesson segments
- **Resizable Panels**: Customizable three-panel layout with drag-to-resize
- **Search Functionality**: Find specific content within transcripts
- **Settings Management**: Configure Google Cloud credentials and preferences

## Installation

### Prerequisites

- **Node.js** (version 18 or higher)
- **npm**, **yarn**, **pnpm**, or **bun** package manager
- **Google Cloud Account** (for cloud features)

### Step-by-Step Installation

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd summit_mol
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```bash
   touch .env.local
   ```

4. **Configure Google Cloud (Optional)**
   ```bash
   # Add to .env.local
   GOOGLE_CREDENTIALS_BASE64=<your-base64-encoded-credentials>
   GOOGLE_CLOUD_PROJECT_ID=<your-project-id>
   ```

## Getting Started

### Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser (or the port shown in terminal if 3000 is occupied).

### First-Time Setup

1. **Upload Transcripts**: Use the "Add New Transcript" button on the main page
2. **Configure Settings**: Click the settings gear icon to set up Google Cloud integration
3. **Upload Feature Definitions**: Upload annotation framework definitions via the upload interface

## Usage Guide

### Main Dashboard

The main dashboard (`/`) provides:

- **Transcript List**: View all available transcripts with quick access
- **Upload Interface**: Add new transcripts via Excel files or ZIP archives
- **Settings Panel**: Configure cloud integration and preferences
- **Feature Definition Management**: Upload and manage annotation frameworks

### Transcript Annotation Page

Navigate to any transcript (e.g., `/transcript/t001`) to access the full annotation interface:

#### Three-Panel Layout

1. **Left Panel - Student-facing Prompts**
   - View lesson prompts and educational context
   - Toggle visibility with "Show/Hide Prompts" button
   - Resizable for optimal workspace

2. **Center Panel - Transcript**
   - Main annotation workspace
   - Color-coded speaker identification
   - Row selection for creating learning goal notes
   - Real-time search functionality

3. **Right Panel - Annotation Tools**
   - Feature category selection (Conceptual, Discursive, etc.)
   - Click-to-annotate cells with visual indicators
   - Feature definitions popup with examples

#### Filtering Options

**Speaker Filtering Dropdown:**
- 🔊 All Speakers
- 🎓 Students Only  
- 👨‍🏫 Teachers Only
- Individual speakers with color indicators

**Segment Filtering Dropdown:**
- 📝 All Segments
- 📋 Individual lesson segments

#### Annotation Workflow

1. **Select Feature Category**: Choose from available annotation frameworks
2. **Read Feature Definitions**: Click any feature code to view detailed definitions
3. **Annotate Transcript**: Click cells to toggle feature annotations
4. **Create Learning Notes**: Select rows and create pedagogical observations
5. **Save Progress**: Use "Save Annotations" to preserve your work
6. **Export Results**: Generate reports in various formats

### Advanced Features

#### Learning Goal Notes

1. Click "Create Learning Goal Note" button
2. Select relevant transcript rows
3. Add pedagogical observations and insights
4. Save notes for later reference and analysis

#### Comparison Tools

- **Compare with Experts**: View side-by-side expert annotations
- **Compare with LLM**: See AI-generated analysis
- **Unified Comparison**: Comprehensive multi-source comparison

#### Cloud Integration

1. Configure Google Cloud credentials in Settings
2. Use "Upload to Cloud" to sync annotations
3. Automatic backup and version control

## File Formats

### Transcript Files (.xlsx/.csv)

**Required Columns:**
- `#` - Line number or sequence
- `Speaker` - Person speaking
- `Dialogue` - Spoken content

**Optional Columns:**
- `In cue` - Start timestamp
- `Out cue` - End timestamp  
- `Segment` - Lesson segment identifier
- `Selectable` - Mark rows available for annotation ("yes"/"no")

**Example:**
```csv
#,Speaker,Dialogue,In cue,Out cue,Segment,Selectable
1,Teacher,"Welcome to class",00:00:01,00:00:04,intro,yes
2,Student 1,"Thank you",00:00:05,00:00:07,intro,yes
```

### Feature Definition Files (.xlsx)

**Required Structure:**
- Separate sheets for each category (Conceptual, Discursive, Talk, Lexical)
- Columns: `Code`, `Definition`, `Example1`, `Example2`, `NonExample1`, `NonExample2`

### ZIP Upload Format

For bulk uploads, create ZIP files containing:
```
transcripts.zip
├── t001/
│   ├── transcript.csv
│   ├── speakers.json
│   └── content.json
├── t002/
│   └── transcript.xlsx
└── ...
```

## Google Cloud Integration

### Setup Process

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable APIs**
   - Enable Google Sheets API
   - Enable Google Cloud Storage API

3. **Create Service Account**
   - Go to IAM & Admin → Service Accounts
   - Create new service account
   - Download JSON credentials file

4. **Configure Credentials**
   - Base64 encode your credentials JSON file
   - Add to `.env.local` as `GOOGLE_CREDENTIALS_BASE64`
   - Or upload via Settings panel in the application

5. **Share Google Sheets**
   - Share target Google Sheets with service account email
   - Grant Editor permissions

### Environment Variables

```bash
# .env.local
GOOGLE_CREDENTIALS_BASE64=<base64-encoded-json-credentials>
GOOGLE_CLOUD_PROJECT_ID=<your-project-id>
GOOGLE_CLOUD_KEY_FILE=<path-to-service-account-json> # Alternative to base64
```

## API Documentation

### Core Endpoints

#### Transcript Management
- `POST /api/upload-transcript` - Upload single transcript file
- `POST /api/upload-zip` - Upload ZIP archive with multiple transcripts
- `POST /api/upload-all-transcripts` - Bulk upload all transcripts to cloud
- `GET /api/list-transcripts` - Get list of available transcripts
- `DELETE /api/delete-transcript` - Remove transcript from system

#### Annotation Data
- `POST /api/submit` - Save annotation data
- `GET /api/sheets/[rater]` - Get rater-specific annotations
- `POST /api/sheets/[rater]/annotate` - Save rater annotations

#### Content Management
- `POST /api/update-content` - Update transcript content and metadata
- `POST /api/upload-feature-definition` - Upload annotation framework definitions
- `GET /api/get-feature-categories` - Get available annotation categories

#### Media Management
- `POST /api/upload-image` - Upload images for transcripts
- `DELETE /api/delete-image` - Remove images

#### Settings
- `POST /api/save-settings` - Save user preferences and cloud credentials

### Response Formats

**Success Response:**
```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Detailed error message",
  "code": "ERROR_CODE"
}
```

## Technical Architecture

### Technology Stack

- **Frontend**: React 19, Next.js 15, TypeScript
- **Styling**: Tailwind CSS
- **Data Processing**: 
  - `xlsx` - Excel file processing
  - `papaparse` - CSV parsing
  - `sbd` - Sentence boundary detection
- **Cloud Integration**: 
  - `googleapis` - Google Sheets/Drive API
  - `@google-cloud/storage` - Google Cloud Storage
- **Utilities**: 
  - `archiver` - ZIP file creation
  - `lodash` - Data manipulation

### Project Structure

```
summit_mol/
├── src/app/                 # Next.js app directory
│   ├── api/                # API routes
│   ├── components/         # React components
│   ├── transcript/[number]/ # Dynamic transcript pages
│   └── tabs/               # Tab components
├── public/                 # Static files and transcript data
│   ├── t001/, t002/, ...   # Transcript folders
│   └── MOL Roles Features.xlsx # Feature definitions
├── types/                  # TypeScript type definitions
└── temp/                   # Temporary processing files
```

### Key Components

- **AnnotationPanel**: Main annotation interface
- **ExpertsComparisonView**: Expert annotation comparison
- **LLMComparisonView**: AI analysis comparison  
- **UnifiedComparisonView**: Multi-source comparison
- **TranscriptUpload**: File upload interface
- **FeatureDefinitionsViewer**: Definition management
- **Settings**: Configuration management

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# If port 3000 is occupied, Next.js automatically uses the next available port
# Check terminal output for the actual URL (e.g., http://localhost:3002)
```

#### Google Cloud Authentication
```bash
# Error: "Could not load the default credentials"
# Solution: Ensure GOOGLE_CREDENTIALS_BASE64 is properly set in .env.local
# Or configure credentials via Settings panel
```

#### File Upload Failures
```bash
# Error: "Missing required columns"
# Solution: Ensure Excel files have required columns: #, Speaker, Dialogue
# Check that columns are properly named (case-sensitive)
```

#### Annotation Not Saving
```bash
# Error: Annotations disappear after page refresh
# Solution: Click "Save Annotations" button before navigating away
# Check browser console for error messages
```

### Performance Optimization

- **Large Transcripts**: For transcripts with >1000 rows, consider splitting into segments
- **Memory Usage**: Clear browser cache if experiencing slowdowns
- **Network Issues**: Ensure stable internet connection for cloud features

### Debug Mode

Enable detailed logging by adding to `.env.local`:
```bash
NODE_ENV=development
DEBUG=true
```

### Getting Help

1. **Check Browser Console**: Look for JavaScript errors and warnings
2. **Review Server Logs**: Check terminal output for API errors
3. **Validate File Formats**: Ensure uploaded files match required formats
4. **Test Google Cloud Setup**: Use Settings panel to verify cloud connectivity

## Contributing

### Development Workflow

1. Fork the repository
2. Create feature branch (`git checkout -b feature/new-feature`)
3. Make changes and test thoroughly
4. Commit with descriptive messages
5. Submit pull request with detailed description

### Code Standards

- **TypeScript**: All new code must be TypeScript
- **ESLint**: Follow existing linting rules
- **Component Structure**: Use functional components with hooks
- **API Design**: Follow RESTful conventions
- **Error Handling**: Implement comprehensive error handling

## License

This project is designed for educational research purposes. Please respect data privacy and institutional requirements when using with real classroom data.

---

For questions or issues, please check the troubleshooting section above or create an issue in the repository.
