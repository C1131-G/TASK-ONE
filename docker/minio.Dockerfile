# MinIO's official security release is distributed as source.
FROM golang:1.25-alpine AS source
RUN apk add --no-cache git
ENV CGO_ENABLED=0 GOMAXPROCS=4

FROM source AS server-build
RUN git clone --depth 1 --branch RELEASE.2025-10-15T17-29-55Z https://github.com/minio/minio.git /src
WORKDIR /src
RUN go build -ldflags="-s -w" -o /out/minio .

FROM source AS client-build
RUN git clone --depth 1 --branch RELEASE.2025-08-13T08-35-41Z https://github.com/minio/mc.git /src
WORKDIR /src
RUN go build -ldflags="-s -w" -o /out/mc .

FROM alpine:3.23 AS runtime
RUN apk add --no-cache ca-certificates

FROM runtime AS server
COPY --from=server-build /out/minio /usr/local/bin/minio
ENTRYPOINT ["minio"]

FROM runtime AS client
COPY --from=client-build /out/mc /usr/local/bin/mc
ENTRYPOINT ["mc"]
