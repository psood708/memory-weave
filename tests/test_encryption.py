from memoryweave.models.encryption import encrypt, decrypt


def test_encrypt_decrypt_roundtrip():
    plaintext = "hf_abc123secret"
    ciphertext = encrypt(plaintext)
    assert ciphertext != plaintext.encode()
    assert decrypt(ciphertext) == plaintext


def test_encrypt_returns_bytes():
    result = encrypt("test")
    assert isinstance(result, bytes)
