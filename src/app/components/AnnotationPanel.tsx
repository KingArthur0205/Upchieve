import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export interface FeatureDetails {
  Definition: string;
  example1: string;
  example2: string;
  nonexample1: string;
  nonexample2: string;
}

export interface AnnotationData {
  [sheetName: string]: {
    codes: string[];
    definitions: { [code: string]: FeatureDetails };
    annotations: {
      [rowIndex: number]: {
        [code: string]: boolean;
      };
    };
  };
}

interface Props {
  numRows: number;
  onSave: (data: AnnotationData) => void;
  savedData?: AnnotationData;
  onAnnotationChange?: (data: AnnotationData) => void;
}

// ALLOWED_SHEETS will be loaded dynamically from API
let ALLOWED_SHEETS = ["Talk", "Conceptual", "Discursive", "Lexical"]; // Default fallback

  // Function to parse XLSX annotation data (extracted from existing logic)
const parseXLSXAnnotationData = (arrayBuffer: ArrayBuffer, numRows: number, savedData?: AnnotationData): AnnotationData => {
    const workbook = XLSX.read(arrayBuffer);
    console.log('AnnotationPanel: Excel file loaded. Sheet names:', workbook.SheetNames);
    console.log('AnnotationPanel: Allowed sheets:', ALLOWED_SHEETS);
    
    const data: AnnotationData = {};
    
    // Process only allowed sheets
    workbook.SheetNames
      .filter(name => ALLOWED_SHEETS.includes(name))
      .forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        // Extract codes and definitions
        const codes = (jsonData as {Code?: string}[]).map(row => row.Code).filter((code): code is string => Boolean(code));
        const definitions: { [code: string]: FeatureDetails } = {};
        
        (jsonData as {
          Code?: string;
          Definition?: string;
          Example1?: string;
          example1?: string;
          Example2?: string;
          example2?: string;
          NonExample1?: string;
          nonexample1?: string;
          NonExample2?: string;
          nonexample2?: string;
        }[]).forEach((row) => {
          if (row.Code) {
            definitions[row.Code] = {
              Definition: row.Definition || '',
              example1: row.Example1 || row.example1 || '',
              example2: row.Example2 || row.example2 || '',
              nonexample1: row.NonExample1 || row.nonexample1 || '',
              nonexample2: row.NonExample2 || row.nonexample2 || ''
            };
          }
        });
        
        // Initialize annotations for each line
        const annotations: { [rowIndex: number]: { [code: string]: boolean } } = {};
        for (let i = 0; i < numRows; i++) {
          annotations[i] = {};
          codes.forEach(code => {
            annotations[i][code] = false;
          });
        }
        
        data[sheetName] = {
          codes,
          definitions,
          annotations: savedData?.[sheetName]?.annotations || annotations
        };
      });
    
    return data;
  };

export default function AnnotationPanel({ numRows, onSave, savedData, onAnnotationChange }: Props) {
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [annotationData, setAnnotationData] = useState<AnnotationData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFeatureCategoriesAndAnnotationData = async () => {
      try {
        // First, load the feature categories dynamically
        console.log('AnnotationPanel: Loading feature categories...');
        const categoriesResponse = await fetch('/api/get-feature-categories');
        const categoriesData = await categoriesResponse.json();
        
        if (categoriesData.success) {
          ALLOWED_SHEETS = categoriesData.categories;
          console.log('AnnotationPanel: Loaded feature categories:', ALLOWED_SHEETS, 'from', categoriesData.source);
        }
        
        console.log('AnnotationPanel: Starting to load annotation data from XLSX');
        
        console.log('AnnotationPanel: Loading XLSX file /MOL Roles Features.xlsx');
        const xlsxResponse = await fetch('/MOL%20Roles%20Features.xlsx');
        if (!xlsxResponse.ok) {
          throw new Error(`Failed to fetch annotation file: ${xlsxResponse.statusText}`);
        }
        const arrayBuffer = await xlsxResponse.arrayBuffer();
        const data = parseXLSXAnnotationData(arrayBuffer, numRows, savedData);
        console.log('AnnotationPanel: XLSX data parsed successfully');
        
        setAnnotationData(data);
        setSheetNames(ALLOWED_SHEETS.filter(name => data[name]));
        setLoading(false);
        
        // If there's saved data, make sure it's reflected in the UI immediately
        if (savedData) {
          onAnnotationChange?.(savedData);
        } else {
          onAnnotationChange?.(data);
        }
      } catch (error) {
        console.error('Error loading annotation data:', error);
        setLoading(false);
      }
    };
    
    loadFeatureCategoriesAndAnnotationData();
  }, [numRows, savedData, onAnnotationChange]);

  const handleAnnotationChange = (lineNumber: number, code: string, value: boolean) => {
    if (!selectedSheet) return;
    
    const newData = {
      ...annotationData,
      [selectedSheet]: {
        ...annotationData[selectedSheet],
        annotations: {
          ...annotationData[selectedSheet].annotations,
          [lineNumber]: {
            ...annotationData[selectedSheet].annotations[lineNumber],
            [code]: value
          }
        }
      }
    };
    
    setAnnotationData(newData);
    onAnnotationChange?.(newData);
  };

  const handleSave = () => {
    onSave(annotationData);
  };

  if (loading) {
    return <div>Loading annotation data...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap gap-2 mb-4">
        {sheetNames.map(sheetName => (
          <button
            key={sheetName}
            onClick={() => setSelectedSheet(sheetName === selectedSheet ? null : sheetName)}
            className={`px-3 py-1 rounded-md ${
              sheetName === selectedSheet 
                ? 'bg-blue-600 text-white' 
                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
            }`}
          >
            {sheetName}
          </button>
        ))}
      </div>

      {selectedSheet && (
        <div className="flex flex-col h-full">
          <div className="flex-grow overflow-hidden">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr>
                  {annotationData[selectedSheet].codes.map(code => (
                    <th
                      key={code}
                      className="border border-gray-300 px-2 py-1 text-sm"
                      title={annotationData[selectedSheet].definitions[code].Definition}
                    >
                      {code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: numRows }).map((_, idx) => (
                  <tr key={idx} className="h-10">
                    {annotationData[selectedSheet].codes.map(code => (
                      <td key={code} className="border border-gray-300 px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={annotationData[selectedSheet].annotations[idx][code]}
                          onChange={(e) => handleAnnotationChange(idx, code, e.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <button
            onClick={handleSave}
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Save Annotations
          </button>
        </div>
      )}
    </div>
  );
} 