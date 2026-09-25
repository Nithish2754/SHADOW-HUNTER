import os
import re

storage_path = "src/darkweb_scanner/storage.py"
with open(storage_path, "r", encoding="utf-8") as f:
    code = f.read()

old_create_user = """    def create_user(self, username: str, password_hash: str = None,
                    email: str = None, oauth_provider: str = None,
                    oauth_id: str = None, is_admin: bool = False,
                    must_change_password: bool = False) -> int:
        with self.get_session() as session:
            user = User(
                username=username,
                password_hash=password_hash,
                email=email,
                oauth_provider=oauth_provider,
                oauth_id=oauth_id,
                is_admin=is_admin,
                must_change_password=must_change_password
            )"""

new_create_user = """    def create_user(self, username: str, password_hash: str = None,
                    email: str = None, is_admin: bool = False,
                    must_change_password: bool = False) -> int:
        with self.get_session() as session:
            user = User(
                username=username,
                password_hash=password_hash,
                email=email,
                is_admin=is_admin,
                must_change_password=must_change_password
            )"""

code = code.replace(old_create_user, new_create_user)

with open(storage_path, "w", encoding="utf-8") as f:
    f.write(code)
