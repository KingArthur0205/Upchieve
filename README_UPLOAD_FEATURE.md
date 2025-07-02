# Transcript Upload Feature

## Overview

EduCoder now includes a feature to upload new transcript files via Excel (.xlsx or .xls) files. This feature allows users to add new transcripts to the system without manual file placement.

## How to Use

### 1. Access the Upload Feature

1. Navigate to the main page of EduCoder
2. Click the green "Add New Transcript" button
3. The upload interface will appear below the button

### 2. Upload a Transcript File

You can upload files in two ways:
- **Drag and Drop**: Drag an Excel file directly onto the upload area
- **Click to Select**: Click the "Select Excel File" button to choose a file from your computer

### 3. File Requirements

The uploaded Excel file must contain the following **required columns**:
- `#` - Line number or sequence number
- `Speaker` - Name of the person speaking
- `Dialogue` - The spoken content

**Additional columns are allowed** and will be preserved in the CSV output.

### 4. File Validation

The system will validate:
- File format (must be .xlsx or .xls)
- File size (must be less than 10MB)
- Presence of required columns
- At least one valid data row
- Non-empty Speaker and Dialogue values

### 5. What Happens After Upload

Upon successful upload:
1. A new transcript folder is created with a timestamp-based ID (e.g., `t1703123456789`)
2. The Excel file is converted to CSV format
3. A `speakers.json` file is generated with color assignments for each unique speaker
4. The original Excel file is preserved
5. You are automatically redirected to the new transcript page

## File Structure Created

For each uploaded transcript, the following structure is created in the `public` folder:

```
public/
└── t{timestamp}/
    ├── transcript.csv          # Converted CSV file
    ├── transcript.xlsx         # Original Excel file
    └── speakers.json           # Speaker color assignments
```

## Speaker Color Assignment

The system automatically assigns colors to speakers using a predefined color palette:
- `bg-red-200`, `bg-blue-200`, `bg-green-200`, `bg-yellow-200`
- `bg-purple-200`, `bg-pink-200`, `bg-indigo-200`, `bg-gray-200`
- `bg-orange-200`, `bg-teal-200`, `bg-cyan-200`, `bg-lime-200`

Colors are assigned in order, cycling through the palette if there are more speakers than colors.

## Error Handling

The system provides clear error messages for:
- Missing required columns
- Invalid file format
- File too large
- Empty or invalid data
- Server processing errors

## Example Excel File Format

| # | Speaker | Dialogue | In cue | Out cue | Segment |
|---|---------|----------|--------|---------|---------|
| 1 | Teacher | Hello everyone, welcome to class. | 00:00:01 | 00:00:04 | a |
| 2 | Student 1 | Hi teacher! | 00:00:05 | 00:00:07 | a |
| 3 | Student 2 | Good morning! | 00:00:08 | 00:00:11 | a |

## Technical Details

### API Endpoint
- **URL**: `/api/upload-transcript`
- **Method**: POST
- **Content-Type**: multipart/form-data

### Response Format
```json
{
  "success": true,
  "transcriptId": "t1703123456789",
  "speakers": ["Teacher", "Student 1", "Student 2"],
  "rowCount": 3
}
```

### Error Response Format
```json
{
  "error": "Missing required columns: #, Speaker"
}
```

## Security Considerations

- File size is limited to 10MB
- Only Excel files (.xlsx, .xls) are accepted
- Files are validated for required content before processing
- Invalid files are rejected with appropriate error messages

## Browser Compatibility

The upload feature works in all modern browsers that support:
- File API
- Drag and Drop API
- Fetch API
- FormData API 