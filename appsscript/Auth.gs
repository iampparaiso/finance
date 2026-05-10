var WHITELIST = ['iampparaiso@gmail.com', 'mjaparaiso227@gmail.com'];

function verifyToken(token) {
  if (!token) return null;
  try {
    var res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + token,
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;
    var data = JSON.parse(res.getContentText());
    var email = (data.email || '').toLowerCase();
    return WHITELIST.indexOf(email) !== -1 ? email : null;
  } catch (e) {
    return null;
  }
}

function unauthorized() {
  return ContentService
    .createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function testVerifyToken() {
  // Manual test: replace with a real short-lived token from browser console
  var result = verifyToken('PASTE_REAL_TOKEN_HERE');
  Logger.log('verifyToken result: ' + result);
  // Expected: null (token is fake) — confirms function runs without crashing
}
