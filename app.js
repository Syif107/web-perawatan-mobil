/* ============================================================
   Armada Pelayan Kemanusiaan — jadwal & bukti perawatan armada
   Data disimpan lokal di IndexedDB (termasuk foto bukti).
   ============================================================ */

(() => {
  "use strict";

  const DB_NAME = "garasi-rawat";
  const DB_VERSION = 1;
  const STORE_NAME = "jadwal";
  const MAX_PHOTO_DIMENSION = 1600;
  const MAX_PHOTO_SIZE = 20 * 1024 * 1024;

  const STATUS_LABEL = {
    upcoming: "Terjadwal",
    today: "Hari ini",
    overdue: "Terlambat",
    done: "Selesai",
  };

  const ICON_CHECK = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5"/>
    </svg>`;

  const ICON_UNDO = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
    </svg>`;

  const ICON_PLUS = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14"/>
    </svg>`;

  const ICON_LIST = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
    </svg>`;

  const $ = (selector, root = document) => root.querySelector(selector);

  const els = {
    header: $("#siteHeader"),
    addBtn: $("#addBtn"),
    heroAddBtn: $("#heroAddBtn"),
    todayChip: $("#todayChip"),
    statCars: $("#statCars"),
    statDone: $("#statDone"),
    statPhotos: $("#statPhotos"),
    nextTitle: $("#nextTitle"),
    nextSub: $("#nextSub"),
    nextBadge: $("#nextBadge"),
    filters: $("#filters"),
    scheduleSub: $("#scheduleSub"),
    carousel: $("#carousel"),
    track: $("#track"),
    carouselFooter: $("#carouselFooter"),
    dots: $("#dots"),
    currentSlide: $("#currentSlide"),
    totalSlides: $("#totalSlides"),
    prevBtn: $("#prevBtn"),
    nextBtn: $("#nextBtn"),
    emptyState: $("#emptyState"),
    emptyEyebrow: $("#emptyEyebrow"),
    emptyTitle: $("#emptyTitle"),
    emptyText: $("#emptyText"),
    emptyActionBtn: $("#emptyActionBtn"),
    slideTemplate: $("#slideTemplate"),
    formDialog: $("#formDialog"),
    scheduleForm: $("#scheduleForm"),
    formEyebrow: $("#formEyebrow"),
    formTitle: $("#formTitle"),
    carInput: $("#carInput"),
    carOptions: $("#carOptions"),
    plateInput: $("#plateInput"),
    dateInput: $("#dateInput"),
    costInput: $("#costInput"),
    serviceInput: $("#serviceInput"),
    officerInput: $("#officerInput"),
    officerOptions: $("#officerOptions"),
    notesInput: $("#notesInput"),
    photoDrop: $("#photoDrop"),
    photoInput: $("#photoInput"),
    photoDropEmpty: $("#photoDropEmpty"),
    pickPhotoBtn: $("#pickPhotoBtn"),
    photoDropPreview: $("#photoDropPreview"),
    photoPreview: $("#photoPreview"),
    replacePhotoBtn: $("#replacePhotoBtn"),
    removePhotoBtn: $("#removePhotoBtn"),
    photoProcessing: $("#photoProcessing"),
    formFeedback: $("#formFeedback"),
    saveBtn: $("#saveBtn"),
    saveBtnText: $("#saveBtnText"),
    confirmDialog: $("#confirmDialog"),
    confirmText: $("#confirmText"),
    cancelDeleteBtn: $("#cancelDeleteBtn"),
    confirmDeleteBtn: $("#confirmDeleteBtn"),
    photoDialog: $("#photoDialog"),
    photoDialogImg: $("#photoDialogImg"),
    photoDialogCaption: $("#photoDialogCaption"),
    photoCloseBtn: $("#photoCloseBtn"),
    quickPhotoInput: $("#quickPhotoInput"),
    toast: $("#toast"),
    toastMsg: $("#toastMsg"),
  };

  const state = {
    records: [],
    filter: "all",
    visible: [],
    editingId: null,
    pendingPhoto: null,
    deleteId: null,
    photoTargetId: null,
    activeIndex: 0,
    emptyAction: "add",
    saving: false,
    photoProcessing: false,
  };

  /* ------------------------------------------------------------
     Penyimpanan (IndexedDB)
     ------------------------------------------------------------ */

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB tidak didukung browser ini."));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error("Gagal membuka penyimpanan lokal."));
      };
      request.onblocked = () => {
        console.warn("Penyimpanan lokal sedang dipakai tab lain.");
      };
    });

    return dbPromise;
  }

  async function dbGetAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbPut(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Gagal menyimpan."));
      transaction.onabort = () => reject(transaction.error || new Error("Penyimpanan dibatalkan."));
    });
  }

  async function dbDelete(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Gagal menghapus."));
      transaction.onabort = () => reject(transaction.error || new Error("Penghapusan dibatalkan."));
    });
  }

  /* ------------------------------------------------------------
     Utilitas
     ------------------------------------------------------------ */

  const longDateFormatter = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const shortDateFormatter = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const headerDateFormatter = new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const currencyFormatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }

  function parseISODate(iso) {
    if (!iso || typeof iso !== "string") return new Date(NaN);
    const parts = iso.slice(0, 10).split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
      return new Date(NaN);
    }
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatLong(iso) {
    const date = parseISODate(iso);
    return Number.isNaN(date.getTime()) ? "—" : longDateFormatter.format(date);
  }

  function formatShort(iso) {
    const date = parseISODate(iso);
    return Number.isNaN(date.getTime()) ? "—" : shortDateFormatter.format(date);
  }

  function formatShortFromDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime())
      ? shortDateFormatter.format(date)
      : "—";
  }

  function daysFromToday(iso) {
    const target = parseISODate(iso);
    if (Number.isNaN(target.getTime())) return NaN;
    const now = new Date();
    const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
    const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((targetUtc - nowUtc) / 86400000);
  }

  function getStatus(record) {
    if (record.done) return "done";
    const diff = daysFromToday(record.date);
    if (!Number.isFinite(diff)) return "upcoming";
    if (diff < 0) return "overdue";
    if (diff === 0) return "today";
    return "upcoming";
  }

  function relativeLabel(record) {
    if (record.done) return "Perawatan selesai";
    const diff = daysFromToday(record.date);
    if (!Number.isFinite(diff)) return "";
    if (diff === 0) return "Hari ini";
    if (diff === 1) return "Besok";
    if (diff > 1) return `${diff} hari lagi`;
    if (diff === -1) return "Terlambat 1 hari";
    return `Terlambat ${Math.abs(diff)} hari`;
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `j-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function findRecord(id) {
    return state.records.find((record) => record.id === id) || null;
  }

  function replaceRecord(record) {
    const index = state.records.findIndex((item) => item.id === record.id);
    if (index >= 0) state.records[index] = record;
    else state.records.unshift(record);
  }

  function matchesFilter(record, filter) {
    if (filter === "all") return true;
    return getStatus(record) === filter;
  }

  function sortRecords(records) {
    return [...records].sort((a, b) => {
      const aDone = a.done ? 1 : 0;
      const bDone = b.done ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      if (a.done) {
        const aKey = a.doneAt || a.date || "";
        const bKey = b.doneAt || b.date || "";
        const doneCompare = String(bKey).localeCompare(String(aKey));
        if (doneCompare !== 0) return doneCompare;
      } else {
        const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
        if (dateCompare !== 0) return dateCompare;
      }

      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  function getVisibleRecords() {
    return sortRecords(
      state.records.filter((record) => matchesFilter(record, state.filter))
    );
  }

  function updateTodayChip() {
    els.todayChip.textContent = headerDateFormatter.format(new Date());
  }

  function storageErrorMessage(error) {
    const name = error && error.name ? String(error.name) : "";
    const message = error && error.message ? String(error.message) : "";
    if (name === "QuotaExceededError" || /quota|space/i.test(message)) {
      return "Penyimpanan perangkat penuh. Hapus beberapa foto atau jadwal lama.";
    }
    return "Gagal mengakses penyimpanan lokal. Coba muat ulang halaman.";
  }

  /* ------------------------------------------------------------
     Toast
     ------------------------------------------------------------ */

  let toastTimer = null;

  function showToast(message, type = "success") {
    window.clearTimeout(toastTimer);
    els.toast.classList.remove("show");
    // Paksa browser me-restart animasi transisi.
    void els.toast.offsetWidth;
    els.toast.classList.toggle("is-error", type === "error");
    els.toastMsg.textContent = message;
    els.toast.classList.add("show");
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove("show");
    }, 3400);
  }

  function showFormError(message) {
    els.formFeedback.textContent = message;
    els.formFeedback.hidden = false;
  }

  function hideFormError() {
    els.formFeedback.hidden = true;
    els.formFeedback.textContent = "";
  }

  /* ------------------------------------------------------------
     Render
     ------------------------------------------------------------ */

  function render(options = {}) {
    const focusId = options.focusId || null;
    const visible = getVisibleRecords();
    state.visible = visible;

    renderSlides(visible);
    renderDots(visible);
    updateSummary();
    updateFilters();
    updateSectionMeta(visible);
    updateEmptyState(visible);

    window.requestAnimationFrame(() => {
      if (!visible.length) {
        setActive(0);
        return;
      }
      let index = focusId ? visible.findIndex((record) => record.id === focusId) : 0;
      if (index < 0) index = 0;
      scrollToSlide(index, false);
      setActive(index);
    });
  }

  function renderSlides(records) {
    const fragment = document.createDocumentFragment();
    records.forEach((record, index) => {
      fragment.append(createSlide(record, index, records.length));
    });
    els.track.replaceChildren(fragment);
  }

  function createSlide(record, index, total) {
    const node = els.slideTemplate.content.firstElementChild.cloneNode(true);
    const status = getStatus(record);
    node.dataset.id = record.id;
    node.dataset.status = status;
    node.style.setProperty("--i", String(Math.min(index, 6)));
    node.setAttribute("role", "group");
    node.setAttribute("aria-roledescription", "slide");
    node.setAttribute(
      "aria-label",
      `Slide ${index + 1} dari ${total}: ${record.car}, ${record.service}${
        record.officer ? `, petugas ${record.officer}` : ""
      }`
    );

    const statusPill = $(".status-pill", node);
    statusPill.classList.add(`status--${status}`);
    $(".status-text", node).textContent = STATUS_LABEL[status];

    const photo = $(".slide-photo", node);
    const photoPlaceholder = $(".photo-placeholder", node);
    const zoomButton = $('[data-action="zoom-photo"]', node);
    const mediaPhotoButton = $(".media-photo-btn", node);

    if (record.photo) {
      photo.src = record.photo;
      photo.alt = `Foto bukti perawatan ${record.car} pada ${formatLong(record.date)}${
        record.officer ? ` oleh ${record.officer}` : ""
      }`;
      photo.hidden = false;
      photoPlaceholder.hidden = true;
      zoomButton.hidden = false;
      mediaPhotoButton.hidden = false;
    } else {
      photo.hidden = true;
      photoPlaceholder.hidden = false;
      zoomButton.hidden = true;
      mediaPhotoButton.hidden = true;
    }

    $(".date-main", node).textContent = formatShort(record.date);
    $(".date-rel", node).textContent = relativeLabel(record);
    $(".date-box", node).title = formatLong(record.date);

    $(".car-name", node).textContent = record.car;

    const plate = $(".plate", node);
    if (record.plate) plate.textContent = record.plate;
    else plate.hidden = true;

    $(".service-name", node).textContent = record.service;

    const officerName = $(".officer-name", node);
    officerName.textContent = record.officer || "Belum dicatat";
    officerName.classList.toggle("is-empty", !record.officer);

    const notes = $(".notes", node);
    notes.textContent = record.notes || "Tidak ada catatan tambahan.";
    notes.classList.toggle("is-empty", !record.notes);

    const meta = $(".slide-meta", node);
    const metaItems = [
      {
        label: "Foto bukti",
        value: record.photo ? "Tersedia" : "Belum ada",
        tone: record.photo ? "ok" : "missing",
      },
    ];

    if (
      typeof record.cost === "number" &&
      Number.isFinite(record.cost) &&
      record.cost >= 0
    ) {
      metaItems.push({ label: "Biaya", value: currencyFormatter.format(record.cost) });
    }

    if (record.done && record.doneAt) {
      metaItems.push({
        label: "Selesai pada",
        value: formatShortFromDate(new Date(record.doneAt)),
      });
    }

    metaItems.forEach(({ label, value, tone }) => {
      const item = document.createElement("div");
      item.className = "meta-item";

      const labelEl = document.createElement("span");
      labelEl.className = "meta-label";
      labelEl.textContent = label;

      const valueEl = document.createElement("span");
      valueEl.className = "meta-value";
      if (tone) valueEl.classList.add(`meta-value--${tone}`);
      valueEl.textContent = value;

      item.append(labelEl, valueEl);
      meta.append(item);
    });

    const doneButton = $(".done-btn", node);
    doneButton.classList.toggle("is-done", Boolean(record.done));
    doneButton.innerHTML = record.done
      ? `${ICON_UNDO}<span>Batalkan selesai</span>`
      : `${ICON_CHECK}<span>Tandai selesai</span>`;

    return node;
  }

  function renderDots(records) {
    const fragment = document.createDocumentFragment();

    if (records.length > 1) {
      records.forEach((record, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "dot";
        dot.setAttribute(
          "aria-label",
          `Lihat jadwal ${index + 1}: ${record.car} — ${record.service}`
        );
        dot.addEventListener("click", () => scrollToSlide(index, true));
        fragment.append(dot);
      });
    }

    els.dots.replaceChildren(fragment);
    els.dots.hidden = records.length <= 1;
    els.carouselFooter.hidden = records.length <= 1;
  }

  function updateSummary() {
    const records = state.records;
    const uniqueCars = new Set(
      records
        .map((record) => String(record.car || "").trim().toLowerCase())
        .filter(Boolean)
    );

    els.statCars.textContent = String(uniqueCars.size);
    els.statDone.textContent = String(records.filter((record) => record.done).length);
    els.statPhotos.textContent = String(records.filter((record) => record.photo).length);

    const next = sortRecords(records.filter((record) => !record.done))[0] || null;

    if (!next) {
      if (records.length) {
        els.nextTitle.textContent = "Semua perawatan beres";
        els.nextSub.textContent = "Tidak ada jadwal yang menunggu";
        els.nextBadge.textContent = "Selesai";
        els.nextBadge.dataset.state = "done";
      } else {
        els.nextTitle.textContent = "Belum ada jadwal";
        els.nextSub.textContent = "Tambahkan perawatan pertamamu";
        els.nextBadge.textContent = "—";
        delete els.nextBadge.dataset.state;
      }
      return;
    }

    const status = getStatus(next);
    els.nextTitle.textContent = next.car;
    els.nextSub.textContent = `${next.service} · ${formatShort(next.date)}`;
    els.nextBadge.textContent = STATUS_LABEL[status];
    els.nextBadge.dataset.state = status;
  }

  function updateFilters() {
    const counts = {
      all: state.records.length,
      upcoming: 0,
      today: 0,
      overdue: 0,
      done: 0,
    };

    state.records.forEach((record) => {
      counts[getStatus(record)] += 1;
    });

    els.filters.querySelectorAll("[data-filter]").forEach((chip) => {
      const filter = chip.dataset.filter;
      const countEl = $(".chip-count", chip);
      if (countEl) countEl.textContent = String(counts[filter] || 0);
      const isActive = state.filter === filter;
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function updateSectionMeta(visible) {
    if (!state.records.length) {
      els.scheduleSub.textContent = "Belum ada catatan perawatan.";
      return;
    }

    els.scheduleSub.textContent =
      visible.length === state.records.length
        ? `${state.records.length} jadwal perawatan tersimpan.`
        : `${visible.length} dari ${state.records.length} jadwal ditampilkan.`;
  }

  function updateEmptyState(visible) {
    const isEmpty = visible.length === 0;

    els.emptyState.hidden = !isEmpty;
    els.carousel.hidden = isEmpty;
    els.filters.hidden = state.records.length === 0;

    if (!isEmpty) return;

    if (state.records.length === 0) {
      state.emptyAction = "add";
      els.emptyEyebrow.textContent = "Armada belum tercatat";
      els.emptyTitle.textContent = "Belum ada jadwal perawatan";
      els.emptyText.textContent =
        "Tambahkan armada pertamamu, atur tanggal servis, dan simpan foto sebagai bukti perawatan.";
      els.emptyActionBtn.innerHTML = `${ICON_PLUS}Buat jadwal pertama`;
    } else {
      state.emptyAction = "reset";
      els.emptyEyebrow.textContent = "Tidak ditemukan";
      els.emptyTitle.textContent = "Belum ada jadwal di filter ini";
      els.emptyText.textContent =
        "Coba pilih filter lain, atau kembali lihat semua jadwal perawatanmu.";
      els.emptyActionBtn.innerHTML = `${ICON_LIST}Tampilkan semua`;
    }
  }

  /* ------------------------------------------------------------
     Carousel
     ------------------------------------------------------------ */

  function setActive(index) {
    const count = state.visible.length;
    const max = Math.max(0, count - 1);
    state.activeIndex = Math.min(Math.max(index, 0), max);

    els.currentSlide.textContent = pad2(count ? state.activeIndex + 1 : 0);
    els.totalSlides.textContent = pad2(count);

    Array.from(els.dots.children).forEach((dot, dotIndex) => {
      const isActive = dotIndex === state.activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });

    els.prevBtn.disabled = count <= 1 || state.activeIndex <= 0;
    els.nextBtn.disabled = count <= 1 || state.activeIndex >= max;
  }

  function scrollToSlide(index, smooth) {
    const slide = els.track.children[index];
    if (!slide) return;

    els.track.scrollTo({
      left: slide.offsetLeft,
      behavior: smooth ? "smooth" : "auto",
    });
    setActive(index);
  }

  let scrollFrame = null;

  function handleTrackScroll() {
    if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = null;
      if (!state.visible.length) return;

      const center = els.track.scrollLeft + els.track.clientWidth / 2;
      let closest = 0;
      let closestDistance = Infinity;

      Array.from(els.track.children).forEach((slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(slideCenter - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = index;
        }
      });

      if (closest !== state.activeIndex) setActive(closest);
    });
  }

  /* ------------------------------------------------------------
     Foto
     ------------------------------------------------------------ */

  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Foto tidak bisa dibaca. Coba gunakan format JPG atau PNG."));
      };

      image.src = objectUrl;
    });
  }

  async function compressImage(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      throw new Error("Pilih file foto (JPG, PNG, atau WEBP).");
    }
    if (file.size > MAX_PHOTO_SIZE) {
      throw new Error("Ukuran foto terlalu besar. Maksimal 20 MB.");
    }

    const image = await loadImageFile(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
      throw new Error("Ukuran foto tidak valid.");
    }

    const scale = Math.min(
      1,
      MAX_PHOTO_DIMENSION / Math.max(sourceWidth, sourceHeight)
    );
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser gagal memproses foto.");

    context.fillStyle = "#0a0f10";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.82);
  }

  function setPhotoProcessing(isProcessing) {
    state.photoProcessing = isProcessing;
    els.photoProcessing.hidden = !isProcessing;
    els.pickPhotoBtn.disabled = isProcessing;
    els.replacePhotoBtn.disabled = isProcessing;
    els.removePhotoBtn.disabled = isProcessing;
    // Jangan biarkan form disimpan sebelum foto selesai diproses.
    els.saveBtn.disabled = isProcessing || state.saving;
  }

  function renderFormPhoto() {
    const hasPhoto = Boolean(state.pendingPhoto);
    els.photoDropEmpty.hidden = hasPhoto;
    els.photoDropPreview.hidden = !hasPhoto;

    if (hasPhoto) {
      els.photoPreview.src = state.pendingPhoto;
    } else {
      els.photoPreview.removeAttribute("src");
    }
  }

  async function handleFormPhoto(file) {
    if (!file) return;

    setPhotoProcessing(true);
    try {
      const dataUrl = await compressImage(file);
      state.pendingPhoto = dataUrl;
      hideFormError();
      renderFormPhoto();
    } catch (error) {
      console.error(error);
      showFormError(error.message || "Gagal memproses foto.");
    } finally {
      setPhotoProcessing(false);
      els.photoInput.value = "";
    }
  }

  function openPhotoDialog(record) {
    if (!record || !record.photo) return;
    els.photoDialogImg.src = record.photo;
    els.photoDialogImg.alt = `Foto bukti perawatan ${record.car} pada ${formatLong(record.date)}${
      record.officer ? ` oleh ${record.officer}` : ""
    }`;
    els.photoDialogCaption.textContent = `${record.car} · ${record.service} · ${formatLong(
      record.date
    )}${record.officer ? ` · Petugas ${record.officer}` : ""}`;
    els.photoDialog.showModal();
  }

  function slideElementById(id) {
    return (
      Array.from(els.track.children).find(
        (slide) => slide.dataset.id === id
      ) || null
    );
  }

  /* ------------------------------------------------------------
     Form tambah / edit
     ------------------------------------------------------------ */

  function populateSuggestions(field, datalist) {
    const uniqueNames = new Map();

    state.records.forEach((record) => {
      const name = String(record[field] || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!uniqueNames.has(key)) uniqueNames.set(key, name);
    });

    const names = Array.from(uniqueNames.values()).sort((a, b) =>
      a.localeCompare(b, "id")
    );

    const fragment = document.createDocumentFragment();
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      fragment.append(option);
    });
    datalist.replaceChildren(fragment);
  }

  function populateFormOptions() {
    populateSuggestions("car", els.carOptions);
    populateSuggestions("officer", els.officerOptions);
  }

  function openForm(record = null) {
    state.editingId = record ? record.id : null;
    state.pendingPhoto = record && record.photo ? record.photo : null;

    els.scheduleForm.reset();
    populateFormOptions();

    els.formEyebrow.textContent = record
      ? "Perbarui data perawatan"
      : "Jadwal perawatan";
    els.formTitle.textContent = record ? "Edit jadwal" : "Tambah jadwal";
    els.saveBtnText.textContent = record ? "Simpan perubahan" : "Simpan jadwal";

    els.carInput.value = record ? record.car : "";
    els.plateInput.value = record && record.plate ? record.plate : "";
    els.dateInput.value = record && record.date ? record.date : todayISO();
    els.costInput.value =
      record && typeof record.cost === "number" ? String(record.cost) : "";
    els.serviceInput.value = record ? record.service : "";
    els.officerInput.value = record && record.officer ? record.officer : "";
    els.notesInput.value = record && record.notes ? record.notes : "";

    els.photoDrop.classList.remove("is-dragover");
    els.photoInput.value = "";
    setPhotoProcessing(false);
    hideFormError();
    renderFormPhoto();

    els.formDialog.showModal();

    // Fokus langsung (tanpa delay) agar tidak balapan dengan input pengguna.
    if (window.matchMedia("(min-width: 720px)").matches) {
      els.carInput.focus();
      els.carInput.select();
    }
  }

  function setSaving(isSaving) {
    state.saving = isSaving;
    els.saveBtn.disabled = isSaving || state.photoProcessing;
    els.saveBtnText.textContent = isSaving
      ? "Menyimpan…"
      : state.editingId
        ? "Simpan perubahan"
        : "Simpan jadwal";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const car = els.carInput.value.trim();
    const service = els.serviceInput.value.trim();
    const officer = els.officerInput.value.trim();

    if (!car) {
      els.carInput.focus();
      showFormError("Isi nama mobil atau armada terlebih dahulu.");
      return;
    }
    if (!service) {
      els.serviceInput.focus();
      showFormError("Isi bentuk perawatannya.");
      return;
    }
    if (!officer) {
      els.officerInput.focus();
      showFormError("Isi nama petugas yang melakukan perawatan.");
      return;
    }
    if (!els.dateInput.value) {
      els.dateInput.focus();
      showFormError("Pilih tanggal perawatan.");
      return;
    }
    if (!els.scheduleForm.reportValidity()) {
      showFormError("Lengkapi kolom bertanda * sebelum menyimpan.");
      return;
    }

    hideFormError();

    const existing = state.editingId ? findRecord(state.editingId) : null;
    const rawCost = els.costInput.value.trim();
    const parsedCost = rawCost === "" ? null : Number(rawCost);
    const cost =
      parsedCost !== null && Number.isFinite(parsedCost)
        ? Math.max(0, parsedCost)
        : null;

    const record = {
      id: existing ? existing.id : makeId(),
      car: car.replace(/\s+/g, " "),
      plate: els.plateInput.value.trim().replace(/\s+/g, " ").toUpperCase(),
      date: els.dateInput.value,
      service: service.replace(/\s+/g, " "),
      officer: officer.replace(/\s+/g, " "),
      cost,
      notes: els.notesInput.value.trim(),
      photo: state.pendingPhoto || null,
      done: existing ? Boolean(existing.done) : false,
      doneAt: existing ? existing.doneAt || null : null,
      createdAt: existing ? existing.createdAt || Date.now() : Date.now(),
      updatedAt: Date.now(),
    };

    setSaving(true);
    try {
      await dbPut(record);
      replaceRecord(record);

      if (!matchesFilter(record, state.filter)) {
        state.filter = "all";
      }

      els.formDialog.close();
      render({ focusId: record.id });
      showToast(
        existing ? "Perubahan jadwal berhasil disimpan." : "Jadwal perawatan ditambahkan."
      );
    } catch (error) {
      console.error(error);
      showFormError(storageErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------
     Aksi slide
     ------------------------------------------------------------ */

  async function toggleDone(record) {
    const updated = {
      ...record,
      done: !record.done,
      doneAt: record.done ? null : new Date().toISOString(),
      updatedAt: Date.now(),
    };

    try {
      await dbPut(updated);
      replaceRecord(updated);
      render({ focusId: updated.id });
      showToast(
        updated.done
          ? updated.photo
            ? "Perawatan ditandai selesai. Bukti tersimpan rapi."
            : "Perawatan ditandai selesai. Tambahkan foto buktinya bila ada."
          : "Status selesai dibatalkan."
      );
    } catch (error) {
      console.error(error);
      showToast(storageErrorMessage(error), "error");
    }
  }

  function askDelete(record) {
    state.deleteId = record.id;
    els.confirmText.textContent = record.photo
      ? `Jadwal "${record.service}" untuk ${record.car} akan dihapus permanen beserta foto buktinya.`
      : `Jadwal "${record.service}" untuk ${record.car} akan dihapus permanen.`;
    els.confirmDialog.showModal();
  }

  async function handleDeleteConfirm() {
    const id = state.deleteId;
    if (!id) return;

    els.confirmDeleteBtn.disabled = true;
    try {
      await dbDelete(id);
      state.records = state.records.filter((record) => record.id !== id);
      state.deleteId = null;
      els.confirmDialog.close();
      render();
      showToast("Jadwal berhasil dihapus.");
    } catch (error) {
      console.error(error);
      els.confirmDialog.close();
      showToast(storageErrorMessage(error), "error");
    } finally {
      els.confirmDeleteBtn.disabled = false;
    }
  }

  async function handleQuickPhoto(file) {
    const id = state.photoTargetId;
    state.photoTargetId = null;
    if (!file || !id) return;

    const record = findRecord(id);
    if (!record) return;

    const slide = slideElementById(id);
    if (slide) slide.classList.add("is-processing");

    try {
      const photo = await compressImage(file);
      const updated = {
        ...record,
        photo,
        updatedAt: Date.now(),
      };
      await dbPut(updated);
      replaceRecord(updated);
      render({ focusId: id });
      showToast("Foto bukti berhasil disimpan.");
    } catch (error) {
      console.error(error);
      if (slide) slide.classList.remove("is-processing");
      showToast(error.message || "Gagal menyimpan foto.", "error");
    }
  }

  /* ------------------------------------------------------------
     Event listener
     ------------------------------------------------------------ */

  function bindEvents() {
    els.addBtn.addEventListener("click", () => openForm());
    els.heroAddBtn.addEventListener("click", () => openForm());

    els.filters.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-filter]");
      if (!chip) return;
      const filter = chip.dataset.filter;
      if (!filter || filter === state.filter) return;
      state.filter = filter;
      render();
    });

    els.emptyActionBtn.addEventListener("click", () => {
      if (state.emptyAction === "add") {
        openForm();
      } else {
        state.filter = "all";
        render();
      }
    });

    els.prevBtn.addEventListener("click", () => {
      scrollToSlide(state.activeIndex - 1, true);
    });
    els.nextBtn.addEventListener("click", () => {
      scrollToSlide(state.activeIndex + 1, true);
    });

    els.track.addEventListener("scroll", handleTrackScroll, { passive: true });

    els.track.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollToSlide(state.activeIndex - 1, true);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollToSlide(state.activeIndex + 1, true);
      } else if (event.key === "Home") {
        event.preventDefault();
        scrollToSlide(0, true);
      } else if (event.key === "End") {
        event.preventDefault();
        scrollToSlide(state.visible.length - 1, true);
      }
    });

    els.track.addEventListener("click", (event) => {
      if (event.target.classList && event.target.classList.contains("slide-photo")) {
        const slide = event.target.closest(".slide");
        const record = slide ? findRecord(slide.dataset.id) : null;
        if (record) openPhotoDialog(record);
        return;
      }

      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;

      const slide = actionEl.closest(".slide");
      if (!slide) return;

      const record = findRecord(slide.dataset.id);
      if (!record) return;

      switch (actionEl.dataset.action) {
        case "quick-photo":
          state.photoTargetId = record.id;
          els.quickPhotoInput.click();
          break;
        case "zoom-photo":
          openPhotoDialog(record);
          break;
        case "edit":
          openForm(record);
          break;
        case "delete":
          askDelete(record);
          break;
        case "toggle-done":
          toggleDone(record);
          break;
        default:
          break;
      }
    });

    els.quickPhotoInput.addEventListener("change", () => {
      const file = els.quickPhotoInput.files && els.quickPhotoInput.files[0];
      els.quickPhotoInput.value = "";
      handleQuickPhoto(file);
    });

    // Form
    els.scheduleForm.addEventListener("submit", handleSubmit);
    els.scheduleForm.addEventListener("input", hideFormError);

    els.formDialog.addEventListener("click", (event) => {
      if (event.target === els.formDialog) {
        els.formDialog.close();
        return;
      }
      if (event.target.closest("[data-close-dialog]")) {
        els.formDialog.close();
      }
    });

    els.formDialog.addEventListener("close", () => {
      state.editingId = null;
      state.pendingPhoto = null;
      els.scheduleForm.reset();
      els.photoDrop.classList.remove("is-dragover");
      els.photoInput.value = "";
      setPhotoProcessing(false);
      hideFormError();
      renderFormPhoto();
      setSaving(false);
    });

    els.plateInput.addEventListener("input", () => {
      const caret = els.plateInput.selectionStart;
      els.plateInput.value = els.plateInput.value.toUpperCase();
      if (caret !== null) {
        els.plateInput.setSelectionRange(caret, caret);
      }
    });

    els.pickPhotoBtn.addEventListener("click", () => els.photoInput.click());
    els.replacePhotoBtn.addEventListener("click", () => els.photoInput.click());

    els.photoDropEmpty.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      els.photoInput.click();
    });

    els.removePhotoBtn.addEventListener("click", () => {
      state.pendingPhoto = null;
      els.photoInput.value = "";
      hideFormError();
      renderFormPhoto();
    });

    els.photoInput.addEventListener("change", () => {
      const file = els.photoInput.files && els.photoInput.files[0];
      handleFormPhoto(file);
    });

    let dragDepth = 0;

    ["dragenter", "dragover"].forEach((eventName) => {
      els.photoDrop.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (eventName === "dragenter") dragDepth += 1;
        els.photoDrop.classList.add("is-dragover");
      });
    });

    els.photoDrop.addEventListener("dragleave", (event) => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) els.photoDrop.classList.remove("is-dragover");
    });

    els.photoDrop.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepth = 0;
      els.photoDrop.classList.remove("is-dragover");
      const file =
        event.dataTransfer && event.dataTransfer.files
          ? event.dataTransfer.files[0]
          : null;
      handleFormPhoto(file);
    });

    // Konfirmasi hapus
    els.cancelDeleteBtn.addEventListener("click", () => {
      els.confirmDialog.close();
    });

    els.confirmDialog.addEventListener("click", (event) => {
      if (event.target === els.confirmDialog) els.confirmDialog.close();
    });

    els.confirmDialog.addEventListener("close", () => {
      state.deleteId = null;
    });

    els.confirmDeleteBtn.addEventListener("click", handleDeleteConfirm);

    // Foto penuh
    els.photoCloseBtn.addEventListener("click", () => els.photoDialog.close());
    els.photoDialog.addEventListener("click", (event) => {
      if (event.target === els.photoDialog) els.photoDialog.close();
    });
    els.photoDialog.addEventListener("close", () => {
      els.photoDialogImg.removeAttribute("src");
    });

    // Header
    const onWindowScroll = () => {
      els.header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    onWindowScroll();

    // Re-alignment setelah ukuran layar berubah
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!state.visible.length) return;
        scrollToSlide(state.activeIndex, false);
      }, 160);
    });
  }

  /* ------------------------------------------------------------
     Inisialisasi
     ------------------------------------------------------------ */

  function watchDayChange() {
    let currentDay = todayISO();

    window.setInterval(() => {
      const day = todayISO();
      if (day === currentDay) return;

      currentDay = day;
      updateTodayChip();
      const focusId =
        state.visible[state.activeIndex] && state.visible[state.activeIndex].id;
      render(focusId ? { focusId } : {});
    }, 60 * 1000);
  }

  async function init() {
    updateTodayChip();
    bindEvents();
    watchDayChange();
    render();

    try {
      const records = await dbGetAll();
      state.records = Array.isArray(records)
        ? records.filter(
            (record) =>
              record &&
              typeof record === "object" &&
              typeof record.id === "string" &&
              typeof record.car === "string" &&
              typeof record.service === "string" &&
              typeof record.date === "string"
          )
        : [];
    } catch (error) {
      console.error(error);
      showToast(
        "Penyimpanan lokal tidak tersedia. Data mungkin tidak tersimpan permanen.",
        "error"
      );
    }

    render();
  }

  init();
})();
