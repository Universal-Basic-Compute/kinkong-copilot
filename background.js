chrome.runtime.onInstalled.addListener(async () => {
  console.log('KinKong Copilot Extension Installed');
  
  // Check if credentials already exist
  const existing = await chrome.storage.sync.get(['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID']);
  if (!existing.AIRTABLE_API_KEY || !existing.AIRTABLE_BASE_ID) {
    // Set default or production credentials
    await chrome.storage.sync.set({
      AIRTABLE_API_KEY: 'your_production_key',
      AIRTABLE_BASE_ID: 'your_production_base_id'
    });
  }
});
