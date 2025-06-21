# Annotation Files: XLSX Support

The transcript annotation tool loads annotation features and definitions from XLSX file format.

## File Loading

The system loads annotation data from `/MOL Roles Features.xlsx` in the public directory.

## File Format Requirements

### XLSX Format (`MOL Roles Features.xlsx`)

The Excel file should contain separate sheets for each category:
- Each sheet name must match the allowed categories
- Standard Excel column names: `Code`, `Definition`, `Example1`, `Example2`, `NonExample1`, `NonExample2`

| Column | Description | Example |
|--------|-------------|---------|
| `Code` | Feature code identifier | `C.1`, `D.1` |
| `Definition` | Description of the feature | `Use of mathematical language...` |
| `Example1` | First example of the feature | `I added 12 and 18...` |
| `Example2` | Second example (optional) | `The sum of 12 and 18...` |
| `NonExample1` | First non-example | `12 + 18 = 30` |
| `NonExample2` | Second non-example (optional) | `Can we move on...` |

## Allowed Categories

The system currently supports these annotation categories:

- **Talk**: General discourse features
- **Conceptual**: Mathematical conceptual understanding
- **Discursive**: Mathematical discourse and argumentation  
- **Lexical**: Vocabulary and language patterns

*Note: The transcript page specifically uses `["Conceptual", "Discursive"]` while the annotation panel supports all four categories.*

## Implementation Details

### Loading Process

1. **XLSX Loading**: Uses `XLSX.read()` and `XLSX.utils.sheet_to_json()` 
2. **Data Grouping**: Groups rows by sheet/category name
3. **Validation**: Only processes categories that match `ALLOWED_SHEETS`

### Feature Structure

Each loaded feature includes:

```typescript
interface FeatureDetails {
  Definition: string;
  example1: string;
  example2: string; 
  nonexample1: string;
  nonexample2: string;
}
```

### Error Handling

- Console logging shows loading progress
- Missing columns are handled gracefully with empty string defaults
- Invalid sheet names are filtered out during processing

## File Structure

The XLSX file should have separate sheets for each category:
- **Talk** sheet with Talk-related features
- **Conceptual** sheet with mathematical conceptual features  
- **Discursive** sheet with discourse and argumentation features
- **Lexical** sheet with vocabulary and language features

Each sheet should have the same column structure as described above. 