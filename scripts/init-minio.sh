#!/bin/sh
mc alias set local http://minio:9000 minioadmin minioadmin
mc mb local/images --ignore-existing
mc anonymous set download local/images
echo "MinIO bucket 'images' initialized"
