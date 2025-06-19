# Safe-Scan-VT

A web-based application for scanning URLs and files using the [VirusTotal API](https://www.virustotal.com/). This tool allows users to check the safety of URLs and files by analyzing them against VirusTotal's extensive database of antivirus engines and threat intelligence.

<image-card alt="Safe-Scan-VT" src="https://via.placeholder.com/600x300.png?text=Safe-Scan-VT+Demo" ></image-card>

## Features
- **URL Scanning**: Check if a URL is malicious, suspicious, or safe.
- **File Scanning**: Upload files (up to 32MB) for malware analysis.
- **Interactive UI**: Displays scan results with a progress bar, verdict, and detailed statistics.
- **Full Report**: View detailed analysis from multiple antivirus engines in a modal.
- **Responsive Design**: Works seamlessly on desktop and mobile devices.
- **Modern Styling**: Clean and intuitive interface with Tailwind-inspired CSS.

## Demo
- [Live Demo](#) *(Coming soon!)*  


## Prerequisites
- A [VirusTotal API key](https://www.virustotal.com/gui/join-us) (free tier available).
- A modern web browser (e.g., Chrome, Firefox, Safari).
- A local server (e.g., Live Server for VS Code) or hosting service (e.g., Netlify, Vercel).

## Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/safe-scan-VT.git
   cd safe-scan-VT

## Set Up the API Key:
- Obtain a VirusTotal API key from your VirusTotal account.
- Open script.js and replace the API_KEY constant:
- **const API_KEY** = "your-api-key-here";

- **Security Note**: For production, store the API key in an environment variable or use a backend proxy to avoid exposing it in client-side code. Add .env to .gitignore to exclude sensitive files.

## Run the Application:

- Host the project on a local server (e.g., using VS Code’s Live Server extension).
- Alternatively, deploy to a web server (see Deployment).
- Open index.html in a browser to access the scanner.

## Usage

- **Scan a URL**:

- Enter a URL (e.g., https://example.com) in the "Scan a URL" input field.
- Click Scan URL to submit for analysis.
- View results, including a verdict (Safe, Suspicious, or Malicious), detection statistics, and a progress bar.

- **Scan a File**:

- Select a file (max 32MB) using the "Scan a File" input.
- Click Scan File to upload and analyze.
- Results display similar to URL scans, with an option for a detailed report.

- **View Full Report**:

- Click View Full Report in the results to see a detailed breakdown of antivirus engine results in a modal.

## Project Structure

safe-scan-VT/
├── index.html       # Main HTML file with the UI
├── style.css        # CSS styles for the application
├── script.js        # JavaScript for API calls and UI logic
├── LICENSE          # MIT License file
└── README.md        # Project documentation

## Technologies Used

- HTML5: Application structure.
- CSS3: Styling with Tailwind-inspired design and Google Fonts (Inter).
- JavaScript: Handles API requests, result rendering, and modal functionality.
- VirusTotal API: Powers URL and file scanning capabilities.

  ## Security Considerations
  
- **API Key Safety**: Never commit your VirusTotal API key to a public repository. Use a backend proxy or environment variables to secure it. Ensure .env is listed in .gitignore.
- **File Size Limit**: Enforces a 32MB limit for file uploads, per VirusTotal’s free API restrictions.
- **Rate Limits**: The free VirusTotal API has limits (e.g., 4 requests/minute). Consider a paid plan for higher quotas.
- **Sensitive Data**: If your repository was public with a hardcoded API key, revoke the key on VirusTotal and remove it from the commit history using GitHub’s guide.

## Dployment

- To deploy on a hosting service like Netlify or Vercel:
 
## Push the repository to GitHub.
- Connect the repository to your hosting platform via their dashboard.
- Configure a backend proxy (e.g., a Node.js server or serverless function) to securely handle API requests, as the VirusTotal API requires CORS support.
- Test the deployed app to ensure functionality.

- **Note**: Running index.html directly in a browser (file:// protocol) may fail due to CORS restrictions. A server is required.

## Contributing

- **Contributions are welcome! To contribute**:

- Fork the repository.
- Create a branch: git checkout -b feature/your-feature.
- Commit changes: git commit -m "Add your feature".
- Push to the branch: git push origin feature/your-feature.
- Open a pull request.
- Please ensure code follows the project’s style and includes tests where applicable.

License

This project is licensed under the MIT License.

## Acknowledgments

- VirusTotal for providing the API.
- Google Fonts for the Inter font family.
- Inspired by modern web design and security tools.

## Contact

For questions or feedback, email riturajkumar9827@gmail.com or open a GitHub issue.

Happy Scanning! 🔍
