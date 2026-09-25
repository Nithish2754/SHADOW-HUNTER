from src.darkweb_scanner.storage import Storage
from src.darkweb_scanner.auth import hash_password

storage = Storage()
username = "admin"
password = "password"

user = storage.get_user_by_username(username)
if not user:
    storage.create_user(username, hash_password(password), is_admin=True)
    print(f"Created user: {username} with password: {password}")
else:
    print(f"User {username} already exists")
