module.exports = {
    CLIENT_ID: process.env.oauth_id || "12345",
    CLIENT_SECRET: process.env.oauth_secret || "12345",
    PERMITTED_REDIRECT_URLS: process.env.oauth_redirect_url ? process.env.oauth_redirect_url.split(",") : 
      ["https://c2c-us.smartthings.com/oauth/callback",
      "https://c2c-eu.smartthings.com/oauth/callback",
      "https://c2c-ap.smartthings.com/oauth/callback",
      "https://c2c-globald.stacceptance.com/oauth/callback",
      "https://c2c-globals.smartthingsgdev.com/oauth/callback",
      "https://c2c-globald.smartthingsgdev.com/oauth/callback",
      "https://c2c-globala.stacceptance.com/oauth/callback",
      "https://api.smartthings.com/oauth/callback"],
    SESSION_SECRET: process.env.oauth_session_secret || '12345'
};
