import cloudinary
import cloudinary.uploader
from backend.app.config.settings import settings

if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name= settings.CLOUDINARY_CLOUD_NAME,
        api_key= settings.CLOUDINARY_API_KEY,
        api_secret= settings.CLOUDINARY_API_SECRET,
        secure= True
    )
    
def upload_avatar(file_bytes: bytes, user_id: str) -> str:
    """
    Uploads a user avatar to Cloudinary under the 'quantiq/avatars' folder,
    using the user's ID as the public ID so it overwrites their old avatar.
    Applies an auto-face-detection square crop (150x150).
    """
    if not (settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET):
        raise ValueError("Cloudinary credentials are not configured in settings.")
    
    result= cloudinary.uploader.upload(
        file_bytes,
        folder= "quantiq/avatars",
        public_id= f"user_{user_id}",
        overwrite= True,
        resource_type= "image",
        transformation=[
            {"width": 150, "height": 150, "crop": "fill", "gravity": "face"}
        ]
    )
    return result.get("secure_url")