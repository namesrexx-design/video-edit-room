# LYFE Studio worker image: the same tools the PC runs (node, ffmpeg, rclone, git) + headless Blender.
# Every agent that logs into the server works inside this container, on the same files.
FROM node:22-bookworm

ARG BLENDER_VERSION=4.5.3
ARG WITH_BLENDER=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg git curl ca-certificates unzip xz-utils \
      libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libxkbcommon0 libsm6 libice6 \
 && rm -rf /var/lib/apt/lists/*

# rclone: talks to Cloudflare R2 (and Google Drive, if connected)
RUN curl -fsSL https://rclone.org/install.sh | bash

# Blender, headless (blender -b file.blend -P script.py). Skip with --build-arg WITH_BLENDER=0.
RUN if [ "$WITH_BLENDER" = "1" ]; then \
      MAJOR=$(echo "$BLENDER_VERSION" | cut -d. -f1,2); \
      curl -fsSL "https://download.blender.org/release/Blender${MAJOR}/blender-${BLENDER_VERSION}-linux-x64.tar.xz" -o /tmp/blender.tar.xz \
      && mkdir -p /opt/blender && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 \
      && ln -s /opt/blender/blender /usr/local/bin/blender && rm /tmp/blender.tar.xz; \
    fi

ENV LYFE_MEDIA_ROOT=/data/media \
    LYFE_EDITOR_DIR=/data/editor \
    LYFE_PC_SOURCE=

WORKDIR /repo
CMD ["sleep", "infinity"]
