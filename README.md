# 🗂️ DocuVault – Personal Document Management Dashboard

A clean, modern, privacy-focused personal document management dashboard.
Built with **Vanilla JavaScript**, **Chart.js**, and **Phosphor Icons**.

---

## 📁 File Structure

```
DocuVault/
├── index.html    → Main HTML structure
├── styles.css    → All styling (light + dark theme)
├── script.js     → All JavaScript logic (modular, commented)
└── data.json     → Your document dataset (20 sample documents)
```

---

## 🚀 How to Run Locally

> ⚠️ **IMPORTANT**: You cannot open `index.html` directly with `file://` because
> the browser blocks `fetch()` requests to local files for security reasons.
> You **must** use a local HTTP server.

---

### Option 1 — VS Code Live Server (Easiest)
1. Install the **Live Server** extension in VS Code
2. Right-click `index.html` → **"Open with Live Server"**
3. Dashboard opens at `http://127.0.0.1:5500`

---

### Option 2 — Python (no install needed)
```bash
# Navigate to the DocuVault folder
cd path/to/DocuVault

# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```
Then open: **http://localhost:8080**

---

### Option 3 — Node.js (npx)
```bash
cd path/to/DocuVault
npx serve .
```
Then open the URL shown in the terminal.

---

### Option 4 — PHP
```bash
cd path/to/DocuVault
php -S localhost:8080
```

---

## 🎯 Features

| Feature | Description |
|---|---|
| **Dashboard Overview** | Total, High Priority, Expiring Soon, Expired counts |
| **3 Charts** | Category (Donut), Priority (Bar), Expiry Timeline (Bar) |
| **Global Search** | Ctrl+K shortcut. Searches Name, Category, ID, Authority |
| **4 Filters** | Category, Priority, Expiry Status, Status |
| **Sortable Table** | Click any column header to sort asc/desc |
| **Row Highlights** | Expired=red, Expiring Soon=amber, High Priority=red accent |
| **Alerts Page** | Separate cards for Expired, Expiring Soon, Pending |
| **Document Modal** | Full detail view on click |
| **Dark Mode** | Toggle in sidebar footer (saved to localStorage) |
| **Hide Sensitive Fields** | Toggle in topbar (blurs doc numbers, contact, email) |
| **Export CSV** | Downloads filtered data as CSV |
| **Responsive** | Works on mobile, tablet, laptop |
| **Auto Expiry Calc** | ExpiryStatus is auto-calculated from ExpiryDate |

---

## 📊 Connecting Your Google Sheet

1. In Google Sheets, go to **File → Share → Publish to Web**
2. Choose **JSON format** and copy the URL
3. In `script.js`, replace the fetch URL:
   ```js
   const response = await fetch('YOUR_GSHEET_JSON_URL');
   ```
4. Map the column names in `data.json` to match your sheet headers

---

## 🗃️ data.json Schema

```json
[
  {
    "DocumentID":   "001",
    "Name":         "Passport",
    "Category":     "Identity",
    "Priority":     "High | Medium | Low",
    "Status":       "Done | Pending | Updating",
    "Authority":    "Ministry of External Affairs",
    "Type":         "Government ID",
    "DocumentNumber": "P1234567",
    "Nominee":      "N/A",
    "InitialDate":  "2018-03-15",
    "LastUpdate":   "2023-03-15",
    "ExpiryDate":   "2028-03-14",
    "ExpiryStatus": "(auto-calculated — you can leave blank)",
    "Address":      "123, MG Road, Meerut",
    "HolderName":   "Raj Kumar Sharma",
    "FathersName":  "Suresh Sharma",
    "Contact":      "+91-9876543210",
    "Email":        "email@example.com",
    "Notes":        "Any notes, Google Drive links, etc."
  }
]
```

> **ExpiryStatus is auto-calculated** from `ExpiryDate`. Documents expiring
> within 90 days are marked "Expiring Soon". Leave the field blank in your JSON.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + K` | Focus search bar |
| `Escape`   | Close detail modal |

---

## 🎨 Customization

- **Colors**: Edit `CATEGORY_COLORS` in `script.js`
- **Expiry threshold**: Change `EXPIRY_SOON_DAYS = 90` in `script.js`
- **Theme**: CSS variables in `:root` and `[data-theme="dark"]` in `styles.css`
- **Add Google Drive download links**: Put the Drive link in the `Notes` field

---

## 🔒 Privacy

- All data is **local only** — nothing is sent to any server
- Sensitive fields (Document Number, Contact, Email) can be hidden with the eye toggle
- Preferences saved in `localStorage` (theme + sensitive toggle state)
