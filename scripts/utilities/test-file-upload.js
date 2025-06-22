const { Client, Storage, ID } = require('node-appwrite');
const fs = require('fs');

// Check if File or InputFile is available
console.log('Checking available file handling methods...');

// Try to import InputFile if it exists
try {
  const { InputFile } = require('node-appwrite');
  console.log('InputFile is available');
} catch (e) {
  console.log('InputFile is not available');
}

// Check for File in global scope
console.log('Global File:', typeof File);

// Check what the SDK expects
const client = new Client();
const storage = new Storage(client);

// Check the createFile method signature
console.log('\nStorage.createFile parameters:');
const createFileString = storage.createFile.toString();
console.log(createFileString.substring(0, 200) + '...');