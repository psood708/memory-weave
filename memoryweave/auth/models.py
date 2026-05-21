from dataclasses import dataclass


@dataclass
class UserSession:
    user_id: str
    email: str
    name: str = ""


@dataclass
class User:
    id: str
    google_sub: str
    email: str
    name: str
