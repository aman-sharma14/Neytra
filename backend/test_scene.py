import requests
import base64

# A small 1x1 red JPEG pixel in base64
valid_base64_jpeg = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="

print("Sending POST /scene...")
try:
    response = requests.post(
        "http://127.0.0.1:8001/scene",
        json={"frame": valid_base64_jpeg, "location_id": None},
        timeout=30
    )
    print("Status:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
