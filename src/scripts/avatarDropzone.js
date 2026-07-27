const MAX_SIZE_BYTES = 5 * 1024 * 1024; // keep in sync with src/lib/avatarStorage.ts
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function init() {
  const dropzone = document.getElementById("avatarDropzone");
  if (!dropzone) return;

  const input = document.getElementById("avatar");
  const idle = dropzone.querySelector(".auth-file-drop-idle");
  const browseBtn = document.getElementById("avatarBrowseBtn");
  const preview = document.getElementById("avatarPreview");
  const thumb = document.getElementById("avatarThumb");
  const filename = document.getElementById("avatarFilename");
  const removeBtn = document.getElementById("avatarRemoveBtn");
  const errorBox = document.getElementById("avatarClientError");

  let objectUrl = null;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  function showIdle() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    idle.hidden = false;
    preview.hidden = true;
    thumb.removeAttribute("src");
  }

  function showPreview(file) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    thumb.src = objectUrl;
    filename.textContent = file.name;
    idle.hidden = true;
    preview.hidden = false;
  }

  function handleFile() {
    clearError();
    const file = input.files && input.files[0];
    if (!file) {
      showIdle();
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      input.value = "";
      showIdle();
      showError("Profile picture must be a PNG, JPEG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      input.value = "";
      showIdle();
      showError("Profile picture must be smaller than 5MB.");
      return;
    }
    showPreview(file);
  }

  input.addEventListener("change", handleFile);

  browseBtn.addEventListener("click", (event) => {
    // Mouse clicks hit the transparent input layered on top (native click
    // and drag-and-drop support); this covers keyboard activation of the
    // visible button, which mouse hit-testing never reaches.
    event.preventDefault();
    input.click();
  });

  removeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    input.value = "";
    clearError();
    showIdle();
  });

  let dragDepth = 0;
  dropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth++;
    dropzone.classList.add("auth-file-drop--dragover");
  });
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  dropzone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      dropzone.classList.remove("auth-file-drop--dragover");
    }
  });
  dropzone.addEventListener("drop", () => {
    dragDepth = 0;
    dropzone.classList.remove("auth-file-drop--dragover");
  });
}

// Re-run on every navigation, not just the first: Astro's View Transitions
// swap page content without a full reload, so scripts only re-attach
// listeners to the fresh DOM when hooked to this event.
document.addEventListener("astro:page-load", init);
