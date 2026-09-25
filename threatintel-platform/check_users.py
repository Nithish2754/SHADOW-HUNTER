from src.darkweb_scanner.storage import Storage, User
from src.darkweb_scanner.auth import check_password

s = Storage()
with s.get_session() as session:
    users = session.query(User).all()
    for u in users:
        print(f"User: {u.username}")
        print(f"Password Check for 'password': {check_password('password', u.password_hash)}")
