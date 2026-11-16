# Complaint Logging System

**Complaint Logging System** is a web-based complaint management application designed to simplify and streamline reporting and resolving public sanitation issues. It helps users log complaints with location details while enabling authorities to monitor, track, and update complaint statuses in real time.

By leveraging modern web technologies, the platform provides an interactive and responsive environment for managing civic complaints efficiently.

## Features
- **Complaint Submission:** Allows citizens to submit public sanitation complaints with descriptions and location details.
- **Real-Time Live Updates:** Uses WebSockets to broadcast newly logged complaints and status updates instantly without page reloads.
- **Manager Dashboard:** Provides a dedicated administrative portal for tracking, reviewing, and resolving complaints.
- **Geolocation Support:** Calculates location coordinates and distances to map and organize complaints accurately.
- **Persistent Storage:** Stores all complaint records and status history securely in a NoSQL database.
- **Interactive Interface:** Offers a clean, user-friendly web interface for both citizens and managers.

## Project Structure
- `Frontend/`: Contains the frontend application, HTML pages (`index.html`, `manager.html`), stylesheets, and client-side scripts.
- `Backend/`: Contains the Flask server (`app.py`), environment configuration template, and Python dependencies (`requirements.txt`).
- `.gitignore`: Specifies files and directories (such as `venv/` and `.env`) that should not be tracked by Git.
- `README.md`: Contains project documentation and setup instructions.

## Prerequisites
- Python (3.8 or higher)
- pip (Python Package Manager)
- MongoDB (Local instance or MongoDB Atlas URI)
- Git

## Setup Instructions
1. Clone the repository:
   git clone https://github.com/Piyush-tech-99/complaint-logging-system.git
2. Navigate to the project directory:
   cd complaint-logging-system
3. Create and activate a virtual environment:
   python -m venv Backend/venv
   .\Backend\venv\Scripts\Activate.ps1
4. Navigate to the backend directory and install dependencies:
   cd Backend
   pip install -r requirements.txt
5. Create a `.env` file inside `Backend/` using `.env.example` and add your MongoDB URI and secret key.
6. Start the backend server:
   python app.py
7. Open `http://127.0.0.1:5000` in your browser to access the application.

## Technologies Used
- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Python, Flask, Flask-SocketIO, Flask-CORS
- **Database:** MongoDB, PyMongo
- **Version Control:** Git and GitHub

## Project Objective
The main objective of Complaint Logging System is to bridge the gap between citizens and municipal authorities by providing a transparent, real-time platform for reporting and resolving public sanitation issues.

## Future Enhancements
- User and manager authentication with role-based access control.
- Image upload support for attaching photo evidence to complaints.
- Interactive map view showing live complaint markers and hotspots.
- Automated email or SMS notifications on complaint status changes.
- Analytics dashboard with resolution time metrics and category reports.

## Screenshots
<img width="1451" height="835" alt="Screenshot 2026-11-17 003033" src="https://github.com/user-attachments/assets/538dcca7-1a22-43eb-9552-2c3cb29194e4" />
<img width="1378" height="675" alt="Screenshot 2026-11-17 002802" src="https://github.com/user-attachments/assets/e2553b7f-6819-4b16-8ac0-099587fadb01" />
<img width="1463" height="678" alt="Screenshot 2026-11-17 003154" src="https://github.com/user-attachments/assets/02e9e308-31b4-44bd-b567-fe2ef44b59d3" />



