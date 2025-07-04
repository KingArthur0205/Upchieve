<p align="center">
  <img src="https://github.com/KingArthur0205/EduCoder/blob/main/figures/Icon.png" width="500"/>
</p>

# EduCoder

**EduCoder** is an open-source user interface(UI) designed to facilitate the annotation of educational conversation transcript.
It provides a practical and efficient interface for essential annotation tasks such as customisablee feature codebook, LLM-based reference annotation, and real-time cross-annotator IRR analysis to meet the needs of researchers and teachers.
This toolkit aims to enhance the accessibility and efficiency of educational conversation transcript annotation, as well as advance both natural language processing (NLP) and education research.
By simplifying these key operations, the UI supports the efficient exploration of text data annotation in education.

## 📖 Table of Contents
[**Overview**](#overview)| [**Installation**](#installation) ｜ [**Tutorials**](#tutorials) | [File Formats](#file-formats) ｜ [**Troubleshooting**](#troubleshooting) | [**Future Extensions**](#future-extensions) | [**Citation**](#citation)

## Overview

## Installation
You can install the UI with ```npm```: 
   ```bash
   git clone https://github.com/KingArthur0205/summit_mol
   cd summit_mol
   npm install # Install Dependencies
   ```

## Getting Started
To run the UI:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser (or the port shown in terminal if 3000 is occupied).

### Upload Transcript

Click  <img src="figures/Add_Transcript_Button.png" alt="Add New Transcript" style="height: 2em; vertical-align: middle;" />   on the navigation page. Files need to be in either XLSX or CSV formats.

**Required columns:**  
- `#` — Line number  
- `Speaker` — Speaker name or ID  
- `Dialogue` — The text of the utterance  

**Optional columns:**  
- `Selectable` — Mark with `"yes"` to enable annotation. If omitted, all rows are annotatable.  
- `Segment` — Group rows (e.g., `"a"`, `"b"`, `"c"`) for better viewing and filtering.

### Upload Feature Definition Codebook
Click <img src="figures/Add_Feature_Button.png" alt="Add New Transcript" style="height: 2em; vertical-align: middle;" /> on the navigation page. Upload an `.xlsx` or `.csv` file to define annotation features.  
Each sheet (XLSX) or file (CSV) becomes a feature category.

**Required columns:** `Code`, `Definition`  
**Optional columns:** `Example1`, `Example2`, `NonExample1`, `NonExample2`

- **XLSX**: Each sheet is a separate category  
- **CSV**: Filename (without extension) becomes the category name

### Configure Google Cloud Storage
This project reads and writes data to Google Cloud Storage. To allow this integration:

1. Go to https://console.cloud.google.com/
2. Select IAM & Admin, then select Service Accounts
3. Create a new Service Account.
4. The service account comes with an email address that ends in @cosmic-anthem-412619.iam.gserviceaccount.com -- share the Google sheet to access with this account.
5. Download the service account details as JSON -- this should include a private key and client email.
6. Save the private key and client email as local environment variables. Convert to BASE64 format, and set in the settings of UI.
7. Select Cloud Storage, then select Storage Bucket
8. Create a storage bucket and set the name in the settings of UI.


### Tutorials
### Future Extensions 
### Citation

# --------- Deprecated ---------

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
- **Color-coded Speakers**: Automatic speaker identification with visual color coding

### 📊 Analysis & Comparison

- **Cross-Annotator Comparison**: Side-by-side comparison with other annotators' results
- **Statistical Reports**: Generate comprehensive annotation statistics

### 🔄 Data Management

- **Transcript Upload**: Drag-and-drop Excel file upload for new transcripts
- **Bulk Upload**: Upload multiple transcripts simultaneously via ZIP files
- **Cloud Sync**: Automatic synchronization with Google Cloud Storage
- **Export Functions**: Export annotations in multiple formats (XLSX, CSV)

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
2. **Read Instructions and Feature Definitions**: Click any feature code to view detailed definitions
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
- **Compare with Other Annotators**: Upload and compare multiple annotator data files
- **Unified Comparison**: Comprehensive multi-source comparison

#### Multi-Annotator Comparison

The Multi-Annotator Comparison page allows you to compare annotations from multiple annotators with your own annotations. This is useful for measuring inter-rater reliability (IRR) and understanding differences in annotation approaches.

### Features

1. **XLSX File Upload**: Upload annotation files from other annotators in XLSX format
2. **Expert Management**: Name and describe each expert annotator
3. **Category and Feature Comparison**: Compare annotations across different categories and features
4. **Visual Comparison**: Color-coded comparison showing agreements and disagreements
5. **IRR Statistics**: Calculate and display inter-rater reliability statistics
6. **Search Functionality**: Search through line numbers and utterances
7. **Notes Comparison**: Compare notes from different annotators (NEW!)
8. **Data Persistence**: Uploaded data persists when you close and return to the page

### XLSX File Format

Each XLSX file should contain:

#### Annotation Sheets (Required)
- **Sheet names**: Category names (e.g., "Conceptual", "Discursive", "Lexical", "Talk")
- **Columns**:
  - `Line #`: Line number in the transcript
  - `Speaker`: Speaker name
  - `Utterance`: The utterance text
  - **Feature columns**: One column for each feature with annotation values

#### Notes Sheet (Optional)
- **Sheet name**: "Notes" (case-insensitive)
- **Columns**:
  - `Line #`: Line number in the transcript
  - `Speaker`: Speaker name
  - `Utterance`: The utterance text
  - **Note columns**: One or more columns containing notes
- **Note Format**: Use `abstract||full content` format where:
  - `abstract`: Short summary shown in the table
  - `||`: Separator
  - `full content`: Detailed note content

#### Example Notes Format:
```
Student shows understanding||The student demonstrates clear mathematical understanding by using appropriate sharing language and showing they can conceptualize the division process.
```

### Using the Notes Comparison Feature

1. **Upload XLSX files** that contain a "Notes" sheet
2. **📝 Compare Notes button** will appear when notes data is detected
3. **Click the button** to toggle the notes comparison table
4. **View notes** from different annotators side by side
5. **Color coding**:
   - Purple background: Notes with full content (click to expand)
   - Gray background: Simple notes without additional content
   - "—": No notes for this line

### Sample Files

- `sample_annotator_with_notes.xlsx`: Example file with both annotations and notes
- `sample_annotator_2_with_notes.xlsx`: Second example for comparison testing

### IRR Statistics

The system calculates:
- **Agreement Percentage**: How often annotators agree
- **Total Comparisons**: Number of comparisons made
- **Agreements/Disagreements**: Breakdown of agreement statistics
- **Color Coding**: Green (≥80%), Yellow (60-79%), Red (<60%)

### Tips

1. **File Naming**: Use descriptive filenames as they become the default annotator names
2. **Expert Information**: Add names and descriptions for better organization
3. **Data Persistence**: Your uploaded data is automatically saved and restored
4. **Search**: Use the search bar to quickly find specific lines or utterances
5. **Notes**: Include both abstract and full content in notes for better comparison

## File Formats

### Transcript Files (.xlsx/.csv)

**Required Columns:**
- `#` - Line number or sequence
- `Speaker` - Person speaking
- `Dialogue` - Spoken content

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

### Key Components

- **AnnotationPanel**: Main annotation interface
- **ExpertsComparisonView**: Expert annotation comparison
- **LLMComparisonView**: AI analysis comparison  
- **UnifiedComparisonView**: Multi-source comparison
- **TranscriptUpload**: File upload interface
- **FeatureDefinitionsViewer**: Definition management
- **Settings**: Configuration management

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

### Getting Help

1. **Check Browser Console**: Look for JavaScript errors and warnings
2. **Validate File Formats**: Ensure uploaded files match required formats
3. **Test Google Cloud Setup**: Use Settings panel to verify cloud connectivity

## License

This project is designed for educational research purposes. Please respect data privacy and institutional requirements when using with real classroom data.

---

For questions or issues, please check the troubleshooting section above or create an issue in the repository.
