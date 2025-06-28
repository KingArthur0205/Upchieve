import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    
    // First, try to load from feature-definitions.json (if exists)
    const jsonPath = path.join(publicDir, 'feature-definitions.json');
    if (fs.existsSync(jsonPath)) {
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return NextResponse.json({
        success: true,
        categories: jsonData.categories,
        source: 'uploaded'
      });
    }
    
    // Fallback: try to load from MOL Roles Features.xlsx
    const xlsxPath = path.join(publicDir, 'MOL Roles Features.xlsx');
    if (fs.existsSync(xlsxPath)) {
      const buffer = fs.readFileSync(xlsxPath);
      const workbook = XLSX.read(buffer);
      
      return NextResponse.json({
        success: true,
        categories: workbook.SheetNames,
        source: 'default'
      });
    }
    
    // If no files exist, return empty categories
    return NextResponse.json({
      success: true,
      categories: [],
      source: 'fallback'
    });
    
  } catch (error) {
    console.error('Error getting feature categories:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get feature categories',
      categories: [] // Fallback
    });
  }
} 