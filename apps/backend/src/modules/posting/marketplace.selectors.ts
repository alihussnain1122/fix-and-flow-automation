/** Facebook Marketplace DOM selectors — centralized for maintainability */
export const SELECTORS = {
  login: {
    emailInput: '#email, input[name="email"]',
    passwordInput: '#pass, input[name="pass"], input[type="password"]',
    loginButton: 'button[name="login"], button[type="submit"]',
  },
  checkpoint: {
    bodyText: [
      'checkpoint',
      'confirm your identity',
      'account has been disabled',
      'account restricted',
      'unusual activity',
      'verify it\'s you',
    ],
  },
  marketplace: {
    createListing: 'https://www.facebook.com/marketplace/create/item',
    inbox: 'https://www.facebook.com/marketplace/inbox',
    titleInput: 'input[aria-label*="Title"], input[placeholder*="Title"], label:has-text("Title") + input',
    priceInput: 'input[aria-label*="Price"], input[placeholder*="Price"], label:has-text("Price") + input',
    descriptionInput:
      'textarea[aria-label*="Description"], textarea[placeholder*="Description"], label:has-text("Description") + textarea',
    categoryDropdown: '[aria-label*="Category"], [placeholder*="Category"]',
    locationInput: '[aria-label*="Location"], input[placeholder*="Location"]',
    imageUpload: 'input[type="file"][accept*="image"]',
    addPhotosButton: '[aria-label*="Add photos"], [aria-label*="Add Photos"], text=Add photos',
    nextButton: 'div[aria-label="Next"], button:has-text("Next")',
    publishButton: 'div[aria-label="Publish"], button:has-text("Publish")',
  },
  inbox: {
    conversationList: '[role="row"], [data-testid*="conversation"]',
    messageBubble: '[role="row"] [dir="auto"]',
    messageInput: '[aria-label*="Message"], [contenteditable="true"][role="textbox"]',
    sendButton: '[aria-label*="Send"], [aria-label*="Press Enter to send"]',
  },
} as const;

export const BAN_INDICATORS = [
  'account disabled',
  'account has been locked',
  'confirm your identity',
  'checkpoint',
  'appeal',
  'restricted from using marketplace',
  'violating our terms',
] as const;

export const FLAGGED_INDICATORS = [
  'unusual activity',
  'verify it\'s you',
  'security check',
  'review your account',
] as const;
