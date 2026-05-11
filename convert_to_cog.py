import sys
import rasterio
from rasterio.enums import Resampling

def convert_to_cog(input_path, output_path):
    print(f"Converting {input_path} to Cloud Optimized GeoTIFF...")
    # Simulation: In a real environment with gdal installation would use gdal_translate
    # Here we show the rasterio pattern for a similar outcome
    try:
        with rasterio.open(input_path) as src:
            profile = src.profile.copy()
            profile.update({
                'driver': 'COG',
                'compress': 'deflate',
                'tiled': True,
                'blockxsize': 512,
                'blockysize': 512
            })
            
            with rasterio.open(output_path, 'w', **profile) as dst:
                for i in range(1, src.count + 1):
                    dst.write(src.read(i), i)
        print("Success: COG created.")
    except Exception as e:
        print(f"Error during conversion: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_to_cog.py input.tif output.tif")
    else:
        convert_to_cog(sys.argv[1], sys.argv[2])
