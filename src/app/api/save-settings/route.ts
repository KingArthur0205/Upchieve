import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { 
      googleCredentialsBase64, 
      googleCloudBucketName,
      openaiApiKey,
      claudeApiKey,
      defaultSystemPrompt,
      defaultMachinePrompt
    } = await request.json();
    
    const envPath = path.join(process.cwd(), '.env.local');
    
    // Read existing .env.local file if it exists
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Parse existing environment variables
    const envLines = envContent.split('\n');
    const envVars: { [key: string]: string } = {};
    
    envLines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    // Update or add the Google credentials and bucket name
    if (googleCredentialsBase64 !== undefined) {
      envVars['GOOGLE_CREDENTIALS_BASE64'] = `"${googleCredentialsBase64}"`;
    }
    if (googleCloudBucketName !== undefined) {
      envVars['GOOGLE_CLOUD_BUCKET_NAME'] = `"${googleCloudBucketName}"`;
    }
    
    // Update or add LLM API keys
    if (openaiApiKey !== undefined) {
      envVars['OPENAI_API_KEY'] = `"${openaiApiKey}"`;
    }
    if (claudeApiKey !== undefined) {
      envVars['CLAUDE_API_KEY'] = `"${claudeApiKey}"`;
    }
    
    // Update or add default prompts
    if (defaultSystemPrompt !== undefined) {
      envVars['DEFAULT_SYSTEM_PROMPT'] = `"${defaultSystemPrompt.replace(/"/g, '\\"')}"`;
    }
    if (defaultMachinePrompt !== undefined) {
      envVars['DEFAULT_MACHINE_PROMPT'] = `"${defaultMachinePrompt.replace(/"/g, '\\"')}"`;
    }
    
    // Reconstruct the .env.local file content
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Write the updated content back to .env.local
    fs.writeFileSync(envPath, newEnvContent, 'utf8');
    
    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully'
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    
    const settings = {
      googleCredentialsBase64: '',
      googleCloudBucketName: '',
      openaiApiKey: '',
      claudeApiKey: '',
      defaultSystemPrompt: '',
      defaultMachinePrompt: ''
    };
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');
      
      envLines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
            const keyTrimmed = key.trim();
            
            if (keyTrimmed === 'GOOGLE_CREDENTIALS_BASE64') {
              settings.googleCredentialsBase64 = value;
            } else if (keyTrimmed === 'GOOGLE_CLOUD_BUCKET_NAME') {
              settings.googleCloudBucketName = value;
            } else if (keyTrimmed === 'OPENAI_API_KEY') {
              settings.openaiApiKey = value;
            } else if (keyTrimmed === 'CLAUDE_API_KEY') {
              settings.claudeApiKey = value;
            } else if (keyTrimmed === 'DEFAULT_SYSTEM_PROMPT') {
              settings.defaultSystemPrompt = value;
            } else if (keyTrimmed === 'DEFAULT_MACHINE_PROMPT') {
              settings.defaultMachinePrompt = value;
            }
          }
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error reading settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read settings' },
      { status: 500 }
    );
  }
} 