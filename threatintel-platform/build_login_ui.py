import os

LOGIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shadow Hunter | Login</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-main: #f8fafc;
            --bg-panel: #ffffff;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
            --border-color: #e2e8f0;
            --primary-blue: #3b82f6;
            --primary-hover: #2563eb;
        }
        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-main);
            color: var(--text-primary);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .login-card {
            background: var(--bg-panel);
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
            width: 100%;
            max-width: 400px;
            border: 1px solid var(--border-color);
        }
        .brand {
            text-align: center;
            margin-bottom: 32px;
        }
        .brand h1 {
            color: var(--primary-blue);
            font-size: 1.5rem;
            margin-bottom: 8px;
            font-weight: 700;
        }
        .brand p {
            color: var(--text-secondary);
            font-size: 0.875rem;
        }
        .form-group { margin-bottom: 20px; }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 0.875rem;
            font-weight: 500;
        }
        .form-control {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            font-size: 1rem;
            box-sizing: border-box;
        }
        .form-control:focus {
            outline: none;
            border-color: var(--primary-blue);
            box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
        }
        .btn-primary {
            width: 100%;
            padding: 12px;
            background-color: var(--primary-blue);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .btn-primary:hover {
            background-color: var(--primary-hover);
        }
        .alert {
            padding: 12px;
            background-color: #fee2e2;
            color: #ef4444;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 0.875rem;
            border: 1px solid #fecaca;
        }
    </style>
</head>
<body>
    <div class="login-card">
        <div class="brand">
            <h1>SHADOW HUNTER</h1>
            <p>Threat Intelligence Platform</p>
        </div>
        
        {% if get_flashed_messages() %}
            {% for msg in get_flashed_messages() %}
                <div class="alert">{{ msg }}</div>
            {% endfor %}
        {% endif %}
        
        <form method="POST" action="{{ url_for('auth.login', next=request.args.get('next')) }}">
            <div class="form-group">
                <label>Username</label>
                <input type="text" name="username" class="form-control" required autofocus>
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" class="form-control" required>
            </div>
            <button type="submit" class="btn-primary">Sign In</button>
        </form>
    </div>
</body>
</html>
"""

def update_login():
    os.makedirs("src/darkweb_scanner/dashboard/templates", exist_ok=True)
    with open("src/darkweb_scanner/dashboard/templates/login.html", "w", encoding="utf-8") as f:
        f.write(LOGIN_HTML)

if __name__ == "__main__":
    update_login()
