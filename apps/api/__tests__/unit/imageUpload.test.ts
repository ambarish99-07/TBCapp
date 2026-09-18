import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { testEnv } from "../integration/testDb.js";

const saveMock = vi.fn().mockResolvedValue(undefined);
const fileMock = vi.fn(() => ({ save: saveMock }));
const bucketMock = vi.fn(() => ({ file: fileMock }));

vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn().mockImplementation(() => ({ bucket: bucketMock })),
}));

// Imported after the mock so createImageUploadHandlers picks up the mocked Storage class.
const { createImageUploadHandlers } = await import("../../src/utils/imageUpload.js");

describe("createImageUploadHandlers — GCS_BUCKET_NAME set", () => {
  beforeEach(() => {
    saveMock.mockClear();
    fileMock.mockClear();
    bucketMock.mockClear();
  });

  it("uploads the buffer to the configured bucket and returns a storage.googleapis.com URL", async () => {
    const env = testEnv({ GCS_BUCKET_NAME: "test-bucket" });
    const { uploadMiddleware, handleUpload } = createImageUploadHandlers(env, "menu-images");

    const app = express();
    app.post("/upload", uploadMiddleware, handleUpload);

    const response = await request(app)
      .post("/upload")
      .attach("image", Buffer.from("fake-png-bytes"), { filename: "photo.png", contentType: "image/png" });

    expect(response.status).toBe(201);
    expect(response.body.url).toMatch(/^https:\/\/storage\.googleapis\.com\/test-bucket\/menu-images\/[a-f0-9-]+\.png$/);
    expect(bucketMock).toHaveBeenCalledWith("test-bucket");
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith(expect.any(Buffer), { contentType: "image/png" });
  });

  it("responds 400 when no file is attached", async () => {
    const env = testEnv({ GCS_BUCKET_NAME: "test-bucket" });
    const { uploadMiddleware, handleUpload } = createImageUploadHandlers(env, "menu-images");

    const app = express();
    app.post("/upload", uploadMiddleware, handleUpload);

    const response = await request(app).post("/upload");
    expect(response.status).toBe(400);
    expect(saveMock).not.toHaveBeenCalled();
  });
});
