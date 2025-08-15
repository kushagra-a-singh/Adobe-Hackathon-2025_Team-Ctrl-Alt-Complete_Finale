let ADOBE_API_KEY = "";
let adobeView = null; // AdobeDC.View instance
let adobeViewer = null; // viewer returned by previewFile()
let adobeApis = null; // cached APIs from viewer.getAPIs()
let currentDoc = null;
let currentSections = [];
let ADOBE_READY = false;
let CURRENT_PAGE = 1;
let TOTAL_PAGES = 1; // Track total pages in the current document
let currentSnippets = [];
let HEALTH = {};
let HAS_ANALYSIS = false;

// Text selection variables
let selectedText = "";
let textSelectionInsights = null;
let isProcessingTextSelection = false;

// Toast notification system with debouncing
let toastTimeout = null;
let lastToastMessage = '';
let lastToastType = '';

function toast(message, type = 'info', duration = 4000) {
  // Prevent duplicate toasts
  if (lastToastMessage === message && lastToastType === type) {
    return;
  }

  // Clear existing timeout
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  lastToastMessage = message;
  lastToastType = type;

  const container = document.getElementById('toast');
  if (!container) return;

  // Clear existing toasts
  container.innerHTML = '';

  const toastEl = document.createElement('div');
  toastEl.className = `toast-item ${type} transform translate-x-full opacity-0`;

  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };

  const colors = {
    success: 'from-green-500 to-emerald-500',
    error: 'from-red-500 to-pink-500',
    warning: 'from-yellow-500 to-amber-500',
    info: 'from-blue-500 to-indigo-500'
  };

  toastEl.innerHTML = `
    <div class="flex items-center space-x-3 p-4 bg-gradient-to-r ${colors[type]} text-white rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm min-w-[300px] max-w-[400px]">
      <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
        <i class="${icons[type]} text-lg"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium leading-relaxed">${message}</p>
      </div>
      <button class="toast-close w-6 h-6 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>
  `;

  container.appendChild(toastEl);

  // Animate in
  requestAnimationFrame(() => {
    toastEl.classList.remove('translate-x-full', 'opacity-0');
    toastEl.classList.add('translate-x-0', 'opacity-100');
  });

  // Auto remove
  toastTimeout = setTimeout(() => {
    removeToast(toastEl);
  }, duration);

  // Manual close
  toastEl.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toastEl);
  });
}

function removeToast(toastEl) {
  if (!toastEl) return;

  toastEl.classList.add('translate-x-full', 'opacity-0');

  setTimeout(() => {
    if (toastEl.parentNode) {
      toastEl.parentNode.removeChild(toastEl);
    }
    // Reset last toast tracking
    lastToastMessage = '';
    lastToastType = '';
  }, 300);
}

// Adobe PDF Embed SDK readiness
document.addEventListener('adobe_dc_view_sdk.ready', () => {
  ADOBE_READY = true;
});

// Suppress noisy unhandled rejections from third-party SDK when we explicitly opt-out of features
window.addEventListener('unhandledrejection', (event) => {
  try {
    const msg = String(event.reason && (event.reason.message || event.reason)).toLowerCase();
    if (msg.includes('get_feature_flag') ||
      msg.includes('[object object]') ||
      msg.includes('no callback registered by viewer') ||
      msg.includes('enable-tools-multidoc') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-organize') ||
      msg.includes('enable-pdf-request-signatures') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('enable-tools-multidoc') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-organize') ||
      msg.includes('enable-pdf-request-signatures') ||
      msg.includes('get_feature_flag') ||
      msg.includes('no callback registered') ||
      msg.includes('feature flag') ||
      msg.includes('enable-') ||
      msg.includes('dcweb_') ||
      msg.includes('dcweb_edit_') ||
      msg.includes('dcweb_edit_image_') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('enable-tools-') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-') ||
      msg.includes('enable-pdf-') ||
      msg.includes('enable-pdf-request-') ||
      msg.includes('enable-pdf-request-signatures') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('enable-tools-multidoc') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-organize') ||
      msg.includes('enable-pdf-request-signatures')) {
      event.preventDefault();
      // Optional: console.debug('Suppressed Adobe feature flag rejection');
    }
  } catch (_) { /* ignore */ }
});

// Also trap generic window errors that bubble, if any
window.addEventListener('error', (event) => {
  try {
    const msg = String(event.message || '').toLowerCase();
    const src = String(event.filename || '').toLowerCase();
    if (
      msg.includes('get_feature_flag') ||
      msg.includes('no callback registered by viewer') ||
      msg.includes('#<object>') ||
      msg.includes('enable-tools-multidoc') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-organize') ||
      msg.includes('enable-pdf-request-signatures') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('dcweb_edit_image_experiment') ||
      msg.includes('enable-tools-multidoc') ||
      msg.includes('edit-config') ||
      msg.includes('enable-accessibility') ||
      msg.includes('preview-config') ||
      msg.includes('enable-inline-organize') ||
      msg.includes('enable-pdf-request-signatures') ||
      src.includes('viewsdkinterface.js') ||
      src.includes('adobedcviewapp.js')
    ) {
      event.preventDefault();
    }
  } catch (_) { /* ignore */ }
}, true);

// Filter known noisy console errors from the embedded viewer that don't affect functionality
(() => {
  const originalError = console.error.bind(console);
  console.error = (...args) => {
    try {
      const text = args.map((a) => (typeof a === 'string' ? a : (a && (a.message || a.toString())) || '')).join(' ').toLowerCase();
      if (text.includes('get_feature_flag') && text.includes('no callback registered')) {
        return; // drop noise
      }
      if (text.includes('enable-tools-multidoc') ||
        text.includes('edit-config') ||
        text.includes('enable-accessibility') ||
        text.includes('preview-config') ||
        text.includes('enable-inline-organize') ||
        text.includes('enable-pdf-request-signatures') ||
        text.includes('dcweb_edit_image_experiment') ||
        text.includes('dcweb_edit_image_experiment')) {
        return; // drop Adobe feature flag noise
      }
    } catch (_) { /* ignore */ }
    originalError(...args);
  };
})();

// Theme handling (light/dark)
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const t = document.getElementById('themeToggle');
  if (t) t.textContent = saved === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const t = document.getElementById('themeToggle');
  if (t) t.textContent = next === 'dark' ? '☀️' : '🌙';
}

async function fetchConfig() {
  const res = await fetch('/api/config');
  const data = await res.json();
  ADOBE_API_KEY = data.adobe_embed_api_key || '';
}

async function fetchHealth() {
  try {
    const res = await fetch('/api/health');
    HEALTH = await res.json();

    // Update status badges
    const llmStatus = document.getElementById('llmStatus');
    const ttsStatus = document.getElementById('ttsStatus');

    if (llmStatus) {
      llmStatus.textContent = HEALTH.llm_provider || 'Unknown';
    }

    if (ttsStatus) {
      ttsStatus.textContent = HEALTH.tts_provider || 'Unknown';
    }

    // Update current document name display
    updateCurrentDocName();
  } catch (e) {
    console.error('Health check failed:', e);
  }
}

function updateCurrentDocName() {
  const currentDocNameEl = document.getElementById('currentDocName');
  if (currentDocNameEl && currentDoc) {
    const filename = currentDoc.split('/').pop();
    currentDocNameEl.textContent = filename || 'Unknown document';
  } else if (currentDocNameEl) {
    currentDocNameEl.textContent = 'No document selected';
  }
}

function initAdobeView(url) {
  return new Promise((resolve) => {
    currentDoc = url;
    // Reset cached viewer/APIs for new document
    adobeViewer = null;
    adobeApis = null;

    if (!ADOBE_API_KEY) {
      alert('Adobe Embed API key not configured');
      return resolve(false);
    }

    const clientId = ADOBE_API_KEY;
    const containerId = 'adobe-dc-view';
    const container = document.getElementById(containerId);

    if (!container) {
      console.error('PDF viewer container not found');
      return resolve(false);
    }

    // Clear any existing content
    container.innerHTML = '';

    // Check if AdobeDC is available
    if (!window.AdobeDC || !window.AdobeDC.View) {
      const onReady = () => {
        document.removeEventListener('adobe_dc_view_sdk.ready', onReady);
        initViewer();
      };
      document.addEventListener('adobe_dc_view_sdk.ready', onReady);
      return;
    }

    initViewer();

    async function initViewer() {
      try {
        // Initialize Adobe View SDK
        const config = {
          clientId: clientId,
          divId: containerId
        };

        // Initialize the viewer
        adobeView = new window.AdobeDC.View(config);

        // Preview the file with viewer options
        const viewerConfig = {
          embedMode: 'FULL_WINDOW',
          showDownloadPDF: false,
          showPrintPDF: false,
          showPageControls: true,
          defaultViewMode: 'FIT_WIDTH',
          // Hints for continuous, whole-document scrolling (ignored if not supported)
          viewMode: 'CONTINUOUS',
          pageMode: 'CONTINUOUS',
          scrollMode: 'VERTICAL',
          showAnnotationTools: false,
          showBookmarks: true,
          showThumbnails: true,
          showLeftHandPanel: false,
          showDisabledSaveButton: true,
          enableFormFilling: false,
          showZoomControl: true,
          showFullScreen: true,
          showComment: false,
          enableSearchAPIs: true,
          enablePageNavigation: true,
          enableZoomAPIs: true,
          enableDocumentAPIs: true,
          enableFilePicker: false,
          enablePrinting: false,
          enableDownload: false,
          enableAnnotationAPIs: false,
          enableFormFillingAPIs: false,
          enableAccessibilityAPIs: false,
          enableEditAPIs: false,
          enableDigitalSignatures: false,
          enableMeasurementAPIs: false,
          enableRedactionAPIs: false,
          enableCompareAPIs: false,
          enableOptimizationAPIs: false,
          enableSecurityAPIs: false,
          enableWatermarkAPIs: false,
          enableBarcodeAPIs: false,
          enableOCRAPIs: false,
          enableCompressionAPIs: false,
          enableEncryptionAPIs: false,
          enableDecryptionAPIs: false,
          enableConversionAPIs: false,
          enableValidationAPIs: false,
          enableExtractionAPIs: false,
          enableMergingAPIs: false,
          enableSplittingAPIs: false,
          enableRotationAPIs: false,
          enableCroppingAPIs: false,
          enableScalingAPIs: false,
          enableColorManagementAPIs: false,
          enableImageProcessingAPIs: false,
          enableTextExtractionAPIs: false,
          enableImageExtractionAPIs: false,
          enableMetadataAPIs: true,
          enableBookmarkAPIs: true,
          enableAttachmentAPIs: true,
          enableTextSelectionAPIs: true,
          enableInteractiveTooltipAPIs: true,
          enableCursorAPIs: true,
          enablePageSelectionAPIs: true,
          enablePageZoomAPIs: true,
          enablePageNavigationAPIs: true,
          enablePageRenderingAPIs: true,
          enablePageThumbnailAPIs: true,
          enablePageAnnotationAPIs: false,
          enablePageFormAPIs: false,
          enablePageSignatureAPIs: false,
          enablePageRedactionAPIs: false,
          enablePageMeasurementAPIs: false,
          enablePageCompareAPIs: false,
          enablePageOptimizationAPIs: false,
          enablePageSecurityAPIs: false,
          enablePageWatermarkAPIs: false,
          enablePageBarcodeAPIs: false,
          enablePageOCRAPIs: false,
          enablePageCompressionAPIs: false,
          enablePageEncryptionAPIs: false,
          enablePageDecryptionAPIs: false,
          enablePageConversionAPIs: false,
          enablePageValidationAPIs: false,
          enablePageExtractionAPIs: false,
          enablePageMergingAPIs: false,
          enablePageSplittingAPIs: false,
          enablePageRotationAPIs: false,
          enablePageCroppingAPIs: false,
          enablePageScalingAPIs: false,
          enablePageColorManagementAPIs: false,
          enablePageImageProcessingAPIs: false,
          enablePageTextExtractionAPIs: false,
          enablePageImageExtractionAPIs: false,
          enablePageMetadataAPIs: true,
          enablePageBookmarkAPIs: true,
          enablePageAttachmentAPIs: true,
          enablePageTextSelectionAPIs: true,
          enablePageInteractiveTooltipAPIs: true,
          enablePageCursorAPIs: true,
          enablePagePageSelectionAPIs: true,
          enablePagePageZoomAPIs: true,
          enablePagePageNavigationAPIs: true,
          enablePagePageRenderingAPIs: true,
          enablePagePageThumbnailAPIs: true,
          theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
        };

        // Preview the file
        adobeViewer = await adobeView.previewFile(
          {
            content: { location: { url } },
            metaData: { fileName: url.split('/').pop() },
          },
          viewerConfig
        );

        // Get the total number of pages using the correct API
        try {
          const apis = await adobeViewer.getAPIs();
          if (apis && apis.getPDFMetadata) {
            const metadata = await apis.getPDFMetadata();
            if (metadata && metadata.numPages) {
              TOTAL_PAGES = metadata.numPages;
              updatePageCount();
            }
          }

          // Debug: Log available APIs for troubleshooting
          console.log('Available Adobe viewer APIs:', Object.keys(apis || {}));
          console.log('Viewer instance properties:', Object.keys(adobeViewer || {}));

        } catch (error) {
          console.log('Could not get page count, defaulting to 1');
          TOTAL_PAGES = 1;
          updatePageCount();
        }

        // Set up page change listener using the correct callback
        if (adobeViewer && typeof adobeViewer.registerCallback === 'function') {
          adobeViewer.registerCallback(
            window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
            (event) => {
              if (event.type === 'PAGE_VIEW_CHANGED' && event.data && event.data.pageNumber) {
                const oldPage = CURRENT_PAGE;
                CURRENT_PAGE = event.data.pageNumber;
                console.log(`Page changed from ${oldPage} to ${CURRENT_PAGE}`);
                updatePageCount();

                // Update the goto input field
                const gotoInput = document.getElementById('gotoPageInput');
                if (gotoInput) {
                  gotoInput.value = CURRENT_PAGE;
                }
              }

              // Handle text selection events
              if (event.type === 'TEXT_SELECTION_CHANGED' && event.data) {
                const selectedText = event.data.selectedText || '';
                console.log('Text selection changed:', selectedText);

                if (selectedText && selectedText.trim().length > 10) { // Only process meaningful selections
                  console.log('Processing meaningful text selection:', selectedText.substring(0, 100) + '...');
                  handleTextSelection(selectedText, CURRENT_PAGE);

                  // Also refresh recommendations for current document
                  try { getDocumentRecommendations(); } catch (_) { }
                }
              }

              // Handle text selection start
              if (event.type === 'TEXT_SELECTION_STARTED') {
                console.log('Text selection started');
                // Clear previous insights when new selection starts
                hideTextSelectionUI();
              }

              // Handle text selection end
              if (event.type === 'TEXT_SELECTION_ENDED') {
                console.log('Text selection ended');
              }

              // Debug: Log all events to identify potential conflicts
              console.log('Adobe viewer event:', event.type, event.data);
            }
          );
        }

        // Set up the toolbar
        setupToolbar();

        // Set up text selection events
        setupTextSelectionEvents();

        // Update current document name
        updateCurrentDocName();

        // Update page count after a short delay to ensure viewer is ready
        setTimeout(() => {
          updatePageCount();
        }, 500);

        // Set up a global error handler for the viewer
        window.addEventListener('adobe_dc_view_sdk_error', (event) => {
          console.debug('Adobe PDF Viewer error:', event.detail);
          // Don't show toast for feature flag errors as they're expected
          if (!event.detail?.type?.includes('FEATURE_FLAG')) {
            toast('An error occurred with the PDF viewer', 'error');
          }
        });

        // Store the viewer instance globally
        window.adobeViewer = adobeViewer;
        adobeViewer = adobeViewer;

        resolve(true);
      } catch (error) {
        console.error('Error in initViewer:', error);
        toast('Failed to initialize PDF viewer. Please try again.', 'error');
        resolve(false);
      }
    }
  });
}

// Handle file uploads
async function uploadFiles() {
  const input = document.getElementById('fileInput');
  if (!input.files.length) {
    toast('Please select files to upload', 'warning');
    return;
  }

  // Validate file types
  const files = Array.from(input.files);
  const invalidFiles = files.filter(file => !file.type.includes('pdf'));

  if (invalidFiles.length > 0) {
    toast(`Invalid file type(s): ${invalidFiles.map(f => f.name).join(', ')}. Only PDF files are supported.`, 'error');
    return;
  }

  // Show upload progress UI
  showUploadProgress();

  const form = new FormData();
  for (const f of files) form.append('files', f);

  try {
    // Create XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        updateUploadProgress(percentComplete, `Uploading ${files.length} file(s)...`);
      }
    });

    // Handle upload completion
    xhr.addEventListener('load', async () => {
      if (xhr.status === 200) {
        updateUploadProgress(100, 'Upload completed!', 'success');
        toast(`Successfully uploaded ${files.length} file(s)! 🎉`, 'success');

        // Reload documents list
        await loadDocuments();

        // Hide progress after a short delay
        setTimeout(() => {
          hideUploadProgress();
        }, 1500);
      } else {
        updateUploadProgress(0, 'Upload failed', 'error');
        toast(`Upload failed: ${xhr.statusText || 'Unknown error'}`, 'error');
        hideUploadProgress();
      }
    });

    // Handle upload errors
    xhr.addEventListener('error', () => {
      updateUploadProgress(0, 'Upload failed', 'error');
      toast('Upload failed: Network error', 'error');
      hideUploadProgress();
    });

    // Handle upload timeout
    xhr.addEventListener('timeout', () => {
      updateUploadProgress(0, 'Upload timed out', 'error');
      toast('Upload failed: Request timed out', 'error');
      hideUploadProgress();
    });

    // Start the upload
    xhr.open('POST', '/api/upload');
    xhr.timeout = 300000; // 5 minutes timeout for large files
    xhr.send(form);

  } catch (error) {
    console.error('Upload error:', error);
    updateUploadProgress(0, 'Upload failed', 'error');
    toast(`Upload failed: ${error.message}`, 'error');
    hideUploadProgress();
  }
}

// Show upload progress UI
function showUploadProgress() {
  // Create or show upload progress modal
  let progressModal = document.getElementById('uploadProgressModal');
  if (!progressModal) {
    progressModal = document.createElement('div');
    progressModal.id = 'uploadProgressModal';
    progressModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    progressModal.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div class="text-center">
          <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-cloud-upload-alt text-white text-lg"></i>
          </div>
          <h3 class="text-xl font-semibold text-slate-800 dark:text-white mb-4">Uploading Files...</h3>
          
          <!-- Progress Bar -->
          <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 mb-4">
            <div id="uploadProgressBar" class="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
          
          <div class="text-sm text-slate-600 dark:text-slate-400 mb-2">
            <div id="uploadProgressText">Preparing upload...</div>
          </div>
          
          <div class="text-xs text-slate-500 dark:text-slate-400">
            <span id="uploadProgressPercent">0%</span> complete
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(progressModal);
  }

  progressModal.classList.remove('hidden');
}

// Update upload progress
function updateUploadProgress(percent, status, state = 'uploading') {
  const progressBar = document.getElementById('uploadProgressBar');
  const progressText = document.getElementById('uploadProgressText');
  const progressPercent = document.getElementById('uploadProgressPercent');
  const progressModal = document.getElementById('uploadProgressModal');

  if (progressBar) {
    progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;

    // Update progress bar appearance based on state
    progressBar.classList.remove('success', 'error');
    if (state === 'success') {
      progressBar.classList.add('success');
    } else if (state === 'error') {
      progressBar.classList.add('error');
    }
  }

  if (progressText) {
    progressText.textContent = status;
  }

  if (progressPercent) {
    progressPercent.textContent = `${Math.round(percent)}%`;
  }

  // Update modal icon based on state
  if (progressModal) {
    const icon = progressModal.querySelector('.fas');
    if (icon) {
      if (state === 'success') {
        icon.className = 'fas fa-check-circle text-white text-lg';
      } else if (state === 'error') {
        icon.className = 'fas fa-exclamation-circle text-white text-lg';
      } else {
        icon.className = 'fas fa-cloud-upload-alt text-white text-lg';
      }
    }

    // Update modal title based on state
    const title = progressModal.querySelector('h3');
    if (title) {
      if (state === 'success') {
        title.textContent = 'Upload Complete!';
      } else if (state === 'error') {
        title.textContent = 'Upload Failed';
      } else {
        title.textContent = 'Uploading Files...';
      }
    }
  }
}

// Hide upload progress
function hideUploadProgress() {
  const progressModal = document.getElementById('uploadProgressModal');
  if (progressModal) {
    progressModal.classList.add('hidden');
  }
}

async function loadDocuments() {
  const res = await fetch('/api/documents');
  const docs = await res.json();
  const list = document.getElementById('docList');
  list.innerHTML = '';

  docs.forEach((d) => {
    const li = document.createElement('li');
    li.className = 'doc-item group';

    // Create a beautiful document item
    li.innerHTML = `
      <div class="flex items-center space-x-3 flex-1">
        <div class="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
          <i class="fas fa-file-pdf text-white text-sm"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors duration-300">
            ${d.filename}
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400">
            PDF Document
          </div>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <button class="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-300 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0" title="View document">
          <i class="fas fa-eye text-slate-600 dark:text-slate-400 text-xs"></i>
        </button>
        <button class="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all duration-300 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0" title="Delete document" onclick="deleteDocument('${d.filename}')">
          <i class="fas fa-trash text-red-600 dark:text-red-400 text-xs"></i>
        </button>
        <div class="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-all duration-300"></div>
      </div>
    `;

    li.dataset.filename = d.filename;

    // Add click handlers
    li.addEventListener('click', () => {
      // Toggle selection
      li.classList.toggle('selected');

      // Update visual state
      const indicator = li.querySelector('.w-3.h-3');
      const viewBtn = li.querySelector('button');

      if (li.classList.contains('selected')) {
        indicator.className = 'w-3 h-3 rounded-full bg-blue-500 animate-pulse';
        viewBtn.className = 'p-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded-lg transition-all duration-300 opacity-100 transform translate-x-0';
        viewBtn.innerHTML = '<i class="fas fa-check text-blue-600 dark:text-blue-400 text-xs"></i>';
        viewBtn.title = 'Document selected';
      } else {
        indicator.className = 'w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-all duration-300';
        viewBtn.className = 'p-2 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-300 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0';
        viewBtn.innerHTML = '<i class="fas fa-eye text-slate-600 dark:text-slate-400 text-xs"></i>';
        viewBtn.title = 'View document';
      }

      // Load document if not already loaded
      if (li.classList.contains('selected') && currentDoc !== `/files/${d.filename}`) {
        initAdobeView(`/files/${d.filename}`);
      }

      updateSelectedCount();
    });

    list.appendChild(li);
  });

  updateSelectedCount();
}

function getSelectedDocs() {
  const list = document.getElementById('docList');
  const docs = [];
  for (const li of list.children) {
    if (li.classList.contains('selected')) {
      docs.push(li.dataset.filename || li.textContent);
    }
  }
  return docs;
}

// Update the page count display in the UI
function updatePageCount() {
  const pageCountEl = document.getElementById('pageCount');
  if (pageCountEl) {
    pageCountEl.textContent = `/ ${TOTAL_PAGES || '?'}`;
  }

  // Update toolbar UI if available
  if (window.updateToolbarUI) {
    window.updateToolbarUI();
  }
}

// Validate and clamp a page number to the valid range
function clampPageNumber(page) {
  return Math.max(1, Math.min(Math.floor(page || 1), TOTAL_PAGES));
}

function updateSelectedCount() {
  const el = document.getElementById('selectedCount');
  if (!el) return;
  const list = document.getElementById('docList');
  let count = 0;
  for (const li of list.children) if (li.classList.contains('selected')) count++;
  el.textContent = `${count} selected`;
}

function renderSections(sections, relatedMap) {
  const container = document.getElementById('sections');
  container.innerHTML = '';

  if (sections.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8">
        <div class="w-16 h-16 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-chart-line text-slate-400 dark:text-slate-500 text-xl"></i>
        </div>
        <p class="text-slate-500 dark:text-slate-400 text-sm">No sections found. Run analysis to discover document sections.</p>
      </div>
    `;
    return;
  }

  // Create header
  const header = document.createElement('div');
  header.className = 'mb-4';
  header.innerHTML = `
    <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center">
      <div class="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-3">
        <i class="fas fa-chart-line text-white text-xs"></i>
      </div>
      Top Sections (${sections.length})
    </h3>
  `;
  container.appendChild(header);

  currentSections = sections;

  sections.forEach((s, index) => {
    const key = `${s.document}|${s.section_title}|${s.page_number}`;
    const item = document.createElement('div');
    item.className = 'section-item group cursor-pointer';

    item.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center space-x-3 mb-2">
            <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md">
              ${index + 1}
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="section-title text-base font-semibold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                ${s.section_title}
              </h4>
              <div class="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                <span class="flex items-center">
                  <i class="fas fa-file-pdf mr-1"></i>
                  ${s.document}
                </span>
                <span class="flex items-center">
                  <i class="fas fa-file-alt mr-1"></i>
                  Page ${s.page_number}
                </span>
              </div>
            </div>
          </div>
          
          ${s.section_summary ? `
            <p class="section-content text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              ${s.section_summary}
            </p>
          ` : ''}
        </div>
        
        <button class="ml-4 p-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300 opacity-0 group-hover:opacity-100" 
                data-page="${s.page_number}" data-doc="${s.document}" title="Jump to this section">
          <i class="fas fa-external-link-alt text-xs"></i>
        </button>
      </div>
      
      ${relatedMap[key] && relatedMap[key].length > 0 ? `
        <div class="related-sections mt-4">
          <div class="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center">
            <i class="fas fa-link mr-2"></i>
            Related Sections (${relatedMap[key].length})
          </div>
          <div class="flex flex-wrap gap-2">
            ${relatedMap[key].map((r, idx) => `
              <button class="related-item hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-300" 
                      data-page="${r.page_number}" data-doc="${r.document}" title="Jump to ${r.section_title}">
                <div class="flex items-center space-x-2">
                  <span class="text-xs">${idx + 1}</span>
                  <span class="truncate max-w-32">${r.section_title}</span>
                  <span class="text-xs opacity-75">p.${r.page_number}</span>
                </div>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    container.appendChild(item);

    // Add click handlers
    const jumpBtn = item.querySelector('button[data-page]');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const page = parseInt(jumpBtn.getAttribute('data-page'), 10);
        const doc = jumpBtn.getAttribute('data-doc');

        // Load document if not already loaded
        if (currentDoc !== `/files/${doc}`) {
          await initAdobeView(`/files/${doc}`);
          // Wait a bit for the viewer to initialize before jumping to page
          setTimeout(async () => {
            const ok = await jumpToPage(page);
            if (!ok) toast('Navigation failed.', 'error');
          }, 1000);
        } else {
          // Document already loaded, jump directly to page
          const ok = await jumpToPage(page);
          if (!ok) toast('Navigation failed.', 'error');
        }
      });
    }

    // Add click handlers for related sections
    item.querySelectorAll('.related-item').forEach((relBtn) => {
      relBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const page = parseInt(relBtn.getAttribute('data-page'), 10);
        const doc = relBtn.getAttribute('data-doc');

        // Load document if not already loaded
        if (currentDoc !== `/files/${doc}`) {
          await initAdobeView(`/files/${doc}`);
          // Wait a bit for the viewer to initialize before jumping to page
          setTimeout(async () => {
            const ok = await jumpToPage(page);
            if (!ok) toast('Navigation failed.', 'error');
          }, 1000);
        } else {
          // Document already loaded, jump directly to page
          const ok = await jumpToPage(page);
          if (!ok) toast('Navigation failed.', 'error');
        }
      });
    });
  });
}

function renderSnippets(snippets) {
  const container = document.getElementById('snippets');
  container.innerHTML = '';

  if (!snippets || snippets.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6">
        <div class="w-12 h-12 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-xl flex items-center justify-center mx-auto mb-3">
          <i class="fas fa-quote-left text-slate-400 dark:text-slate-500"></i>
        </div>
        <p class="text-slate-500 dark:text-slate-400 text-sm">No snippets found. Run analysis to extract key insights.</p>
      </div>
    `;
    return;
  }

  // Create header
  const header = document.createElement('div');
  header.className = 'mb-4';
  header.innerHTML = `
    <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center">
      <div class="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
        <i class="fas fa-quote-left text-white text-xs"></i>
      </div>
      Key Insights (${snippets.length})
    </h3>
  `;
  container.appendChild(header);

  // De-duplicate by (doc,page,text)
  const seen = new Set();
  const uniq = [];
  snippets.forEach((s) => {
    const key = `${s.document}:${s.page_number}:${s.refined_text}`;
    if (seen.has(key)) return;
    seen.add(key);
    uniq.push(s);
  });

  currentSnippets = uniq;

  uniq.forEach((s, index) => {
    const item = document.createElement('div');
    item.className = 'snippet-item group cursor-pointer';

    item.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md flex-shrink-0">
          ${index + 1}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-2 mb-2 text-xs text-slate-500 dark:text-slate-400">
            <span class="flex items-center">
              <i class="fas fa-file-pdf mr-1"></i>
              ${s.document}
            </span>
            <span class="flex items-center">
              <i class="fas fa-file-alt mr-1"></i>
              Page ${s.page_number}
            </span>
          </div>
          <p class="section-content text-sm text-slate-700 dark:text-slate-300 leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white transition-colors duration-300">
            "${s.refined_text}"
          </p>
        </div>
        
        <button class="ml-3 p-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300 opacity-0 group-hover:opacity-100 flex-shrink-0" 
                data-page="${s.page_number}" data-doc="${s.document}" title="Jump to this snippet">
          <i class="fas fa-external-link-alt text-xs"></i>
        </button>
      </div>
    `;

    container.appendChild(item);

    // Add click handler
    const jumpBtn = item.querySelector('button[data-page]');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const page = parseInt(jumpBtn.getAttribute('data-page'), 10);
        const doc = jumpBtn.getAttribute('data-doc');

        // Load document if not already loaded
        if (currentDoc !== `/files/${doc}`) {
          await initAdobeView(`/files/${doc}`);
          // Wait a bit for the viewer to initialize before jumping to page
          setTimeout(async () => {
            const ok = await jumpToPage(page);
            if (!ok) toast('Navigation failed.', 'error');
          }, 1000);
        } else {
          // Document already loaded, jump directly to page
          const ok = await jumpToPage(page);
          if (!ok) toast('Navigation failed.', 'error');
        }
      });
    }
  });
}

const jumpToPage = async (pageNumber) => {
  if (!adobeViewer) {
    toast('No PDF viewer available.', 'error');
    return false;
  }

  try {
    const clampedPage = clampPageNumber(pageNumber);

    // Try to get the APIs from the viewer
    let apis;
    try {
      apis = await adobeViewer.getAPIs();
    } catch (error) {
      console.error('Failed to get viewer APIs:', error);
      toast('Viewer not ready. Please wait a moment and try again.', 'warning');
      return false;
    }

    // Try multiple navigation methods in order of preference
    let navigationSuccess = false;

    // Method 1: Try gotoLocation with page number
    if (apis && apis.gotoLocation && !navigationSuccess) {
      try {
        await apis.gotoLocation(clampedPage);
        navigationSuccess = true;
      } catch (error) {
        console.log('gotoLocation failed, trying alternative method');
      }
    }

    // Method 2: Try gotoLocation with object parameter
    if (apis && apis.gotoLocation && !navigationSuccess) {
      try {
        await apis.gotoLocation({ pageNumber: clampedPage });
        navigationSuccess = true;
      } catch (error) {
        console.log('gotoLocation with object parameter failed');
      }
    }

    // Method 3: Try navigateToPage if available
    if (apis && apis.navigateToPage && !navigationSuccess) {
      try {
        await apis.navigateToPage(clampedPage);
        navigationSuccess = true;
      } catch (error) {
        console.log('navigateToPage failed');
      }
    }

    // Method 4: Try setPage if available
    if (apis && apis.setPage && !navigationSuccess) {
      try {
        await apis.setPage(clampedPage);
        navigationSuccess = true;
      } catch (error) {
        console.log('setPage failed');
      }
    }

    // Method 5: Try direct viewer manipulation as last resort
    if (!navigationSuccess && adobeViewer) {
      try {
        // Try to access the viewer's internal page property
        if (adobeViewer.page !== undefined) {
          adobeViewer.page = clampedPage;
          navigationSuccess = true;
        } else if (adobeViewer.currentPage !== undefined) {
          adobeViewer.currentPage = clampedPage;
          navigationSuccess = true;
        } else if (adobeViewer.pageNumber !== undefined) {
          adobeViewer.pageNumber = clampedPage;
          navigationSuccess = true;
        }
      } catch (error) {
        console.log('Direct viewer manipulation failed');
      }
    }

    if (navigationSuccess) {
      CURRENT_PAGE = clampedPage;

      // Update the goto input field
      const gotoInput = document.getElementById('gotoPageInput');
      if (gotoInput) {
        gotoInput.value = clampedPage;
      }

      // Update page count display
      updatePageCount();

      toast(`Navigated to page ${clampedPage}`, 'success');
      return true;
    } else {
      toast('Page navigation not available in current viewer. Try refreshing the page.', 'warning');
      return false;
    }
  } catch (error) {
    console.error('Navigation failed:', error);

    // Handle specific Adobe API errors
    if (error.code === 'INVALID_INPUT') {
      toast('Invalid page number. Please try again.', 'error');
    } else if (error.message && error.message.includes('pageNumber')) {
      toast('Page navigation failed. The viewer may not support this feature.', 'warning');
    } else {
      toast('Navigation failed. Please try again.', 'error');
    }

    return false;
  }
};

// Set up a global error handler for the viewer
window.addEventListener('adobe_dc_view_sdk_error', (event) => {
  console.debug('Adobe PDF Viewer error:', event.detail);
  // Don't show toast for feature flag errors as they're expected
  if (!event.detail?.type?.includes('FEATURE_FLAG')) {
    toast('An error occurred with the PDF viewer', 'error');
  }
});

function showTextSelectionLoading() {
  let panel = document.getElementById('textSelectionPanel');

  // Create panel if it doesn't exist
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'textSelectionPanel';
    panel.className = 'fixed top-20 right-4 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40 hidden';
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <div class="p-6">
      <div class="flex items-center space-x-3 mb-4">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <h3 class="text-lg font-semibold text-slate-800 dark:text-white">Analyzing Text Selection...</h3>
      </div>
      
      <!-- Progress Bar -->
      <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-4">
        <div id="textSelectionProgress" class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
      </div>
      
      <div class="text-sm text-slate-600 dark:text-slate-400">
        <div id="textSelectionStatus">Initializing analysis...</div>
      </div>
    </div>
  `;

  panel.classList.remove('hidden');

  // Simulate progress updates
  let progress = 0;
  const progressBar = document.getElementById('textSelectionProgress');
  const status = document.getElementById('textSelectionStatus');

  const progressInterval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress > 90) progress = 90;

    if (progressBar) progressBar.style.width = progress + '%';
    if (status) {
      if (progress < 30) status.textContent = 'Extracting text context...';
      else if (progress < 60) status.textContent = 'Searching across documents...';
      else if (progress < 90) status.textContent = 'Generating insights...';
      else status.textContent = 'Finalizing results...';
    }
  }, 200);

  // Store interval for cleanup
  panel.dataset.progressInterval = progressInterval;
}

function setupToolbar() {
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const gotoBtn = document.getElementById('gotoPageBtn');
  const gotoInput = document.getElementById('gotoPageInput');
  const pageCountEl = document.getElementById('pageCount');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  const textSelectionBtn = document.getElementById('textSelectionBtn');

  if (!prevBtn || !nextBtn || !gotoBtn || !gotoInput || !pageCountEl || !zoomInBtn || !zoomOutBtn || !searchBtn || !searchInput || !textSelectionBtn) {
    console.error('One or more toolbar elements not found');
    return;
  }

  // Navigation functionality
  prevBtn.addEventListener('click', async () => {
    if (CURRENT_PAGE > 1) {
      const ok = await jumpToPage(CURRENT_PAGE - 1);
      if (!ok) toast('Navigation failed.', 'error');
    }
  });

  nextBtn.addEventListener('click', async () => {
    if (CURRENT_PAGE < TOTAL_PAGES) {
      const ok = await jumpToPage(CURRENT_PAGE + 1);
      if (!ok) toast('Navigation failed.', 'error');
    }
  });

  gotoBtn.addEventListener('click', async () => {
    const page = parseInt(gotoInput.value, 10);
    if (page && page >= 1 && page <= TOTAL_PAGES) {
      const ok = await jumpToPage(page);
      if (!ok) toast('Navigation failed.', 'error');
    } else {
      toast('Invalid page number.', 'error');
    }
  });

  gotoInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const page = parseInt(gotoInput.value, 10);
      if (page && page >= 1 && page <= TOTAL_PAGES) {
        const ok = await jumpToPage(page);
        if (!ok) toast('Navigation failed.', 'error');
      } else {
        toast('Invalid page number.', 'error');
      }
    }
  });

  // Zoom functionality
  let currentZoom = 1.0;
  let lastAppliedZoom = 1.0;
  const zoomStep = 0.25;
  const minZoom = 0.25;
  const maxZoom = 3.0;

  zoomInBtn.addEventListener('click', () => {
    if (currentZoom < maxZoom) {
      currentZoom = Math.min(maxZoom, currentZoom + zoomStep);
      applyZoom();
    }
  });

  zoomOutBtn.addEventListener('click', () => {
    if (currentZoom > minZoom) {
      currentZoom = Math.max(minZoom, currentZoom - zoomStep);
      applyZoom();
    }
  });

  function applyZoom() {
    if (!adobeViewer) {
      toast('No PDF viewer available.', 'warning');
      return;
    }

    adobeViewer.getAPIs().then(async apis => {
      if (!apis) {
        toast('Zoom functionality not available in current viewer. Try refreshing the page.', 'warning');
        return;
      }

      let zoomSuccess = false;

      try { console.debug('Zoom diagnostics - API keys:', Object.keys(apis)); } catch (_) { }

      // Preferred: dedicated Zoom APIs
      if (apis.getZoomAPIs && !zoomSuccess) {
        try {
          const zoomAPIs = apis.getZoomAPIs();
          if (zoomAPIs) {
            if (zoomAPIs.setZoom) { zoomAPIs.setZoom(currentZoom); zoomSuccess = true; }
            else if (zoomAPIs.zoom) { zoomAPIs.zoom(currentZoom); zoomSuccess = true; }
            else if (currentZoom > lastAppliedZoom && zoomAPIs.zoomIn) { zoomAPIs.zoomIn(); zoomSuccess = true; }
            else if (currentZoom < lastAppliedZoom && zoomAPIs.zoomOut) { zoomAPIs.zoomOut(); zoomSuccess = true; }
          }
        } catch (_) { }
      }

      // Fallbacks on root APIs
      if (!zoomSuccess && apis.setZoom) { try { apis.setZoom(currentZoom); zoomSuccess = true; } catch (_) { } }
      if (!zoomSuccess && apis.zoom) { try { apis.zoom(currentZoom); zoomSuccess = true; } catch (_) { } }
      if (!zoomSuccess && apis.zoomTo) { try { apis.zoomTo(currentZoom); zoomSuccess = true; } catch (_) { } }

      // Last resort: simulate with command interface
      if (!zoomSuccess && adobeViewer.executeCommand) {
        try {
          const direction = currentZoom > lastAppliedZoom ? 'zoomIn' : 'zoomOut';
          const iterations = Math.max(1, Math.round(Math.abs(currentZoom - lastAppliedZoom) / zoomStep));
          for (let i = 0; i < iterations; i++) adobeViewer.executeCommand(direction);
          zoomSuccess = true;
        } catch (_) { }
      }

      // Read back applied zoom if available
      try {
        const z = apis.getPageZoom ? apis.getPageZoom() : null;
        if (typeof z === 'number' && !Number.isNaN(z)) lastAppliedZoom = z;
        else lastAppliedZoom = currentZoom;
      } catch (_) { lastAppliedZoom = currentZoom; }

      if (zoomSuccess) {
        toast(`Zoom: ${Math.round((lastAppliedZoom || currentZoom) * 100)}%`, 'info');
      } else {
        toast('Zoom functionality not available in current viewer. Try refreshing the page.', 'warning');
      }
    }).catch(error => {
      console.error('Failed to apply zoom:', error);
      toast('Zoom failed. Please try again.', 'error');
    });
  }

  // Search functionality
  searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
      performSearch(query);
    } else {
      toast('Please enter a search term.', 'warning');
    }
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        performSearch(query);
      } else {
        toast('Please enter a search term.', 'warning');
      }
    }
  });

  // Text Selection functionality
  textSelectionBtn.addEventListener('click', async () => {
    // Try to get current page from viewer first
    await updateCurrentPageFromViewer();
    // Show a clean text input modal instead of trying to get selected text
    showTextInputModal();
  });

  async function performSearch(query) {
    if (!adobeViewer) {
      toast('Search not available in current viewer.', 'warning');
      return;
    }

    try {
      // Get the APIs from the viewer
      let apis;
      try {
        apis = await adobeViewer.getAPIs();
      } catch (error) {
        console.error('Failed to get viewer APIs:', error);
        toast('Viewer not ready. Please wait a moment and try again.', 'warning');
        return;
      }

      // Try multiple search methods in order of preference
      let searchSuccess = false;
      let searchResults = null;

      // Method 1: Try performSearch method (this is the correct one based on available APIs)
      if (apis && apis.performSearch && !searchSuccess) {
        try {
          searchResults = await apis.performSearch(query);
          searchSuccess = true;
        } catch (error) {
          console.log('performSearch method failed, trying alternative');
        }
      }

      // Method 2: Try search method
      if (apis && apis.search && !searchSuccess) {
        try {
          searchResults = await apis.search(query);
          searchSuccess = true;
        } catch (error) {
          console.log('search method failed, trying alternative');
        }
      }

      // Method 3: Try searchText method
      if (apis && apis.searchText && !searchSuccess) {
        try {
          searchResults = await apis.searchText(query);
          searchSuccess = true;
        } catch (error) {
          console.log('searchText method failed');
        }
      }

      // Method 4: Try findText method
      if (apis && apis.findText && !searchSuccess) {
        try {
          searchResults = await apis.findText(query);
          searchSuccess = true;
        } catch (error) {
          console.log('findText method failed');
        }
      }

      if (!searchSuccess) {
        // Try to use the viewer's internal search if available
        if (adobeViewer && adobeViewer.executeCommand) {
          try {
            // Try to execute a search command
            adobeViewer.executeCommand('search', { query: query });
            searchSuccess = true;
            toast(`Searching for "${query}"...`, 'info');
            return;
          } catch (error) {
            console.log('executeCommand search failed');
          }
        }

        toast('Search functionality not available in current viewer. Try refreshing the page.', 'warning');
        return;
      }

      // Clear previous search if available
      if (apis.clearSearch) {
        try {
          apis.clearSearch();
        } catch (error) {
          console.log('Could not clear previous search');
        }
      }

      // Determine result count robustly across different SDK return shapes
      const getResultCount = (res) => {
        if (!res) return null;
        if (Array.isArray(res)) return res.length;
        if (typeof res === 'number') return res;
        if (typeof res === 'object') {
          if (typeof res.total === 'number') return res.total;
          if (typeof res.count === 'number') return res.count;
          if (typeof res.matchCount === 'number') return res.matchCount;
          if (typeof res.numResults === 'number') return res.numResults;
          if (res.results && Array.isArray(res.results)) return res.results.length;
          if (res.matches && Array.isArray(res.matches)) return res.matches.length;
          if (res.pages && Array.isArray(res.pages)) {
            // Sum per-page matches if structure is { pages: [{ matches: [...] }, ...] }
            try {
              return res.pages.reduce((sum, p) => sum + (Array.isArray(p.matches) ? p.matches.length : 0), 0);
            } catch (_) { /* ignore */ }
          }
        }
        return null;
      };

      // Also query backend for an accurate count across all pages
      let backendCount = null;
      try {
        if (currentDoc) {
          const file = (currentDoc.split('/').pop() || '').trim();
          const resp = await fetch(`/api/search_count?file=${encodeURIComponent(file)}&q=${encodeURIComponent(query)}`);
          if (resp.ok) {
            const data = await resp.json();
            backendCount = typeof data.total === 'number' ? data.total : null;
          }
        }
      } catch (_) { /* ignore network errors */ }

      const resultCount = backendCount ?? getResultCount(searchResults);

      if (resultCount && resultCount > 0) {
        toast(`Found ${resultCount} result${resultCount === 1 ? '' : 's'} for "${query}"`, 'success');
        try {
          if (Array.isArray(searchResults) && searchResults[0]) {
            if (searchResults[0].pageNumber) await jumpToPage(searchResults[0].pageNumber);
            else if (searchResults[0].page) await jumpToPage(searchResults[0].page);
          }
        } catch (_) { }
      } else if (searchResults) {
        toast(`Search completed for "${query}". Highlights may appear across pages.`, 'info');
      } else {
        toast(`No results found for "${query}"`, 'info');
      }
    } catch (error) {
      console.error('Search failed:', error);

      // Handle specific search errors
      if (error.message && error.message.includes('Search APIs not enabled')) {
        toast('Search is not enabled for this viewer. Please contact support.', 'warning');
      } else if (error.message && error.message.includes('not available')) {
        toast('Search functionality is not available in the current viewer configuration.', 'warning');
      } else {
        toast('Search failed. Please try again.', 'error');
      }
    }
  }

  // Update UI based on current state
  const updateUI = () => {
    const hasPages = TOTAL_PAGES > 0;
    const canGoPrev = hasPages && CURRENT_PAGE > 1;
    const canGoNext = hasPages && CURRENT_PAGE < TOTAL_PAGES;

    prevBtn.disabled = !canGoPrev;
    nextBtn.disabled = !canGoNext;

    if (hasPages) {
      gotoInput.placeholder = `1-${TOTAL_PAGES}`;
      gotoInput.max = TOTAL_PAGES;
      gotoInput.min = 1;
    } else {
      gotoInput.placeholder = '1';
      gotoInput.max = '';
      gotoInput.min = '';
    }

    // Update button styles based on state
    if (canGoPrev) {
      prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      prevBtn.classList.add('hover:bg-white', 'dark:hover:bg-slate-700', 'hover:shadow-lg', 'hover:scale-105');
    } else {
      prevBtn.classList.add('opacity-50', 'cursor-not-allowed');
      prevBtn.classList.remove('hover:bg-white', 'dark:hover:bg-slate-700', 'hover:shadow-lg', 'hover:scale-105');
    }

    if (canGoNext) {
      nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      nextBtn.classList.add('hover:bg-white', 'dark:hover:bg-slate-700', 'hover:shadow-lg', 'hover:scale-105');
    } else {
      nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
      nextBtn.classList.remove('hover:bg-white', 'dark:hover:bg-slate-700', 'hover:shadow-lg', 'hover:scale-105');
    }
  };

  // Initial UI update
  updateUI();

  // Store update function for external calls
  window.updateToolbarUI = updateUI;
}

async function analyze() {
  const persona = document.getElementById('persona').value.trim();
  const job = document.getElementById('job').value.trim();
  const docs = getSelectedDocs();

  if (!docs.length) {
    toast('Please upload/select documents to analyze', 'warning');
    return;
  }

  // Persona and job are now optional
  const personaText = persona || 'General User';
  const jobText = job || 'Understanding document content and structure';

  const btn = document.getElementById('analyzeBtn');
  const prev = btn.innerHTML;

  // Show loading state
  btn.disabled = true;
  btn.innerHTML = `
    <div class="flex items-center space-x-2">
      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      <span>Analyzing...</span>
    </div>
  `;

  // Global progress bar UI
  const gp = document.getElementById('globalProgress');
  const pbar = document.getElementById('progressBar');
  const ppct = document.getElementById('progressPct');
  const pfile = document.getElementById('progressFile');
  const plabel = document.getElementById('progressLabel');
  if (gp) gp.classList.remove('hidden');
  const setProgress = (pct, file, status) => {
    const clamped = Math.max(0, Math.min(100, pct | 0));
    if (pbar) pbar.style.width = `${clamped}%`;
    if (ppct) ppct.textContent = `${clamped}%`;
    if (pfile) pfile.textContent = file ? `Processing: ${file}` : '';
    if (plabel && status) plabel.textContent = status;
  };
  setProgress(1, docs[0] || '', 'Starting...');

  const payload = { persona: personaText, job: jobText, documents: docs, approach: 'nlp', method: 'auto', top_k: 5 };

  try {
    // Kick off async job
    const startRes = await fetch('/api/analyze_async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!startRes.ok) throw new Error(await startRes.text());
    const { job_id } = await startRes.json();

    // Poll progress
    let done = false;
    while (!done) {
      await new Promise(r => setTimeout(r, 600));
      const pr = await fetch(`/api/analyze_progress?id=${encodeURIComponent(job_id)}`);
      if (!pr.ok) throw new Error(await pr.text());
      const pj = await pr.json();
      setProgress(pj.progress || 0, pj.current_file || '', pj.status || 'Processing...');
      if (pj.status === 'error') throw new Error(pj.error || 'Analyze failed');
      if (pj.status === 'done') done = true;
    }

    // Fetch result
    const rr = await fetch(`/api/analyze_result?id=${encodeURIComponent(job_id)}`);
    if (rr.status !== 200) throw new Error('Result not ready');
    const data = await rr.json();

    // Render results
    renderSections(data.extracted_sections, data.related_map);
    renderSnippets(data.snippets);

    // Enable action buttons
    const ib = document.getElementById('insightsBtn');
    const pb = document.getElementById('podcastBtn');
    if (ib) { ib.disabled = false; ib.classList.remove('opacity-50', 'cursor-not-allowed'); }
    if (pb) { pb.disabled = false; pb.classList.remove('opacity-50', 'cursor-not-allowed'); }

    toast('Analysis complete! 🎉', 'success');
    HAS_ANALYSIS = true;
  } catch (e) {
    toast(`Analysis failed: ${e.message || e}`, 'error');
    HAS_ANALYSIS = false;
  } finally {
    // Hide/finish progress UI
    setProgress(100, '', 'Done');
    setTimeout(() => { if (gp) gp.classList.add('hidden'); }, 800);
    // Restore button state
    btn.disabled = false;
    btn.innerHTML = prev;
  }
}

async function insights() {
  if (!HAS_ANALYSIS || (!currentSections.length && !currentSnippets.length)) {
    toast('Run Analyze and ensure sections/snippets are available.', 'error');
    return;
  }
  const persona = document.getElementById('persona').value.trim();
  const job = document.getElementById('job').value.trim();
  const curr = currentSections[0];
  // Use top 3 snippet texts for richer insights
  const relatedTexts = (currentSnippets || []).slice(0, 3).map((s) => s.refined_text);
  const btn = document.getElementById('insightsBtn');
  const prev = btn.textContent; btn.disabled = true; btn.textContent = 'Thinking...';
  try {
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona, job, current_text: curr ? curr.section_title : '', related_texts: relatedTexts }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    document.getElementById('insights').textContent = data.content;
    toast('Insights ready', 'success');
  } catch (e) {
    toast(`Insights failed: ${e.message || e}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = prev;
  }
}

async function podcast() {
  if (!HAS_ANALYSIS || (!currentSections.length && !currentSnippets.length)) {
    toast('Run Analyze first to generate content for podcast.', 'error');
    return;
  }

  const persona = document.getElementById('persona').value.trim() || 'listener';
  const job = document.getElementById('job').value.trim() || 'exploring this content';
  const btn = document.getElementById('podcastBtn');
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Creating Podcast...';

  try {
    // Create enhanced podcast data with sections and snippets
    const sections = currentSections.slice(0, 3); // Top 3 sections
    const snippets = currentSnippets.slice(0, 5); // Top 5 snippets

    // Create related insights from sections and snippets
    const relatedInsights = [];

    // Add sections as insights
    sections.forEach((section, index) => {
      relatedInsights.push({
        document: section.document,
        page_number: section.page_number,
        section_title: section.section_title,
        relevant_text: section.section_summary || section.section_title,
        relevance_score: 0.9 - (index * 0.1), // Decreasing relevance
        insight_type: "section",
        jump_url: `/files/${section.document}#page=${section.page_number}`
      });
    });

    // Add snippets as insights
    snippets.forEach((snippet, index) => {
      relatedInsights.push({
        document: snippet.document,
        page_number: snippet.page_number,
        section_title: `Key Insight ${index + 1}`,
        relevant_text: snippet.refined_text,
        relevance_score: 0.85 - (index * 0.05), // Decreasing relevance
        insight_type: "snippet",
        jump_url: `/files/${snippet.document}#page=${snippet.page_number}`
      });
    });

    // Use the ENHANCED podcast API for dual voices and better quality
    const enhancedPodcastData = {
      selected_text: sections.length > 0 ? sections[0].section_summary || sections[0].section_title :
        snippets.length > 0 ? snippets[0].refined_text :
          "Analysis of selected documents",
      related_insights: relatedInsights,
      document: currentDoc ? currentDoc.split('/').pop() : 'analyzed_documents',
      page_number: CURRENT_PAGE || 1,
      conversation_style: "academic",
      persona: persona,
      job: job
    };

    console.log('Creating enhanced podcast with data:', enhancedPodcastData);

    // Send to enhanced podcast endpoint for dual voice generation
    const res = await fetch('/api/enhanced-podcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enhancedPodcastData)
    });

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    const player = document.getElementById('player');

    console.log('Enhanced podcast response:', data);
    console.log('Audio URL from API:', data.url);

    // Set up the audio player with new source
    const audioUrl = data.url + '?t=' + Date.now(); // Add timestamp to prevent caching
    console.log('Final audio URL:', audioUrl);

    player.src = audioUrl;
    player.setAttribute('title', `AI Podcast: ${job} (Dual Voice)`);

    // Reset audio player initialization to ensure proper setup
    resetAudioPlayerInitialization();

    // Initialize audio player UI before loading
    initializeAudioPlayer();

    // Clear any existing audio info
    const audioInfo = document.getElementById('audioInfo');
    const audioTitle = document.getElementById('audioTitle');
    if (audioInfo) audioInfo.classList.add('hidden');
    if (audioTitle) audioTitle.textContent = 'Loading dual voice podcast...';

    // Wait for audio to load metadata
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Audio loading timeout'));
      }, 15000); // 15 second timeout for enhanced podcast

      player.addEventListener('loadedmetadata', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });

      player.addEventListener('error', (e) => {
        clearTimeout(timeout);
        reject(new Error(`Audio loading failed: ${e.message || 'Unknown error'}`));
      }, { once: true });

      player.load(); // Force load
    });

    // Initialize audio player UI if not already done
    initializeAudioPlayer();

    // Play the podcast
    await player.play();

    // Update UI to show it's playing
    const playPauseBtn = document.getElementById('playPauseBtn');

    if (playPauseBtn) {
      const icon = playPauseBtn.querySelector('i');
      if (icon) icon.className = 'fas fa-pause text-sm';
    }

    if (audioInfo) audioInfo.classList.remove('hidden');
    if (audioTitle) audioTitle.textContent = `AI Podcast: ${job} (Dual Voice)`;

    toast('High-quality dual voice podcast is now playing! 🎧', 'success');

  } catch (e) {
    console.error('Enhanced podcast error:', e);
    toast(`Podcast failed: ${e.message || 'Unknown error'}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

async function createPodcastScript(persona, job) {
  try {
    const sections = currentSections.slice(0, 4);
    const snippets = currentSnippets.slice(0, 8);
    if (!sections.length && !snippets.length) throw new Error('No content available for podcast');

    const now = new Date();
    const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
    const personaIntro = persona ? `${persona}` : 'curious learner';

    const openers = [
      `${greeting}! You're tuned in to a focused deep-dive designed for ${personaIntro}.`,
      `${greeting}! Welcome back—this session is crafted especially for ${personaIntro}.`,
      `${greeting}! Let's get into it—tailored insights for ${personaIntro}.`
    ];
    const bridges = [
      'Here is the through-line that ties it together: ',
      'Let us connect the dots across sections: ',
      'Zooming out, a few patterns stand out:'
    ];
    const closers = [
      'Thanks for listening—until next time, keep exploring.',
      'That is a wrap—stay curious and keep building.',
      'Appreciate your time—go turn these ideas into momentum.'
    ];

    const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const lines = [];
    // Intro
    lines.push(`${choose(openers)} We're tackling ${job || 'our topic today'}, with crisp insights and quick takeaways.`);

    // Section highlights
    if (sections.length) {
      lines.push(`First, a fast orientation through the key sections.`);
      sections.forEach((s, i) => {
        const title = (s.section_title || `Topic ${i + 1}`).replace(/\s+/g, ' ').trim();
        lines.push(`Section ${i + 1}: ${title}. If you're skimming the PDF, jump to page ${s.page_number}.`);
      });
    }

    // Insights from snippets
    if (snippets.length) {
      lines.push(`Now, distilled insights you can act on:`);
      snippets.slice(0, 5).forEach((snip, i) => {
        const text = (snip.refined_text || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        lines.push(`Insight ${i + 1}: ${text}`);
      });
    }

    // Connections & contradictions (lightly inferred)
    lines.push(choose(bridges));
    const titles = sections.map(s => s.section_title).filter(Boolean);
    if (titles.length >= 2) {
      lines.push(`Notice how ${titles[0]} sets context that ${titles[1]} elaborates with specifics.`);
    }
    if (snippets.length >= 2) {
      lines.push(`There's a subtle tension between two ideas: "${(snippets[0].refined_text || '').slice(0, 80)}" and "${(snippets[1].refined_text || '').slice(0, 80)}." That contrast is worth exploring.`);
    }

    // Practical wrap
    lines.push(`If your goal is ${job || 'to understand the essentials'}, pick one action you can do in the next 24 hours—draft a summary, teach a friend, or test an example.`);

    // Outro
    lines.push(choose(closers));

    // Light SSML pauses for better cadence
    const withPauses = lines
      .map(l => l.replace(/&/g, 'and'))
      .map(l => `<s>${l}</s>`)
      .join('<break time="400ms"/>');

    return withPauses;
  } catch (error) {
    console.error('Error creating podcast script:', error);
    throw error;
  }
}

async function main() {
  await fetchConfig();
  await fetchHealth();
  await loadDocuments();

  // Set up upload functionality
  setupUploadFunctionality();

  document.getElementById('analyzeBtn').addEventListener('click', analyze);
  const ib = document.getElementById('insightsBtn');
  const pb = document.getElementById('podcastBtn');
  if (ib) { ib.disabled = true; ib.addEventListener('click', insights); }
  if (pb) { pb.disabled = true; pb.addEventListener('click', podcast); }
  setupToolbar();

  // Theme
  initTheme();
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  const selectAllBtn = document.getElementById('selectAllBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
  const deleteAllBtn = document.getElementById('deleteAllBtn');

  if (selectAllBtn) selectAllBtn.addEventListener('click', () => {
    const list = document.getElementById('docList');
    for (const li of list.children) li.classList.add('selected');
    updateSelectedCount();
  });
  if (clearSelectionBtn) clearSelectionBtn.addEventListener('click', () => {
    const list = document.getElementById('docList');
    for (const li of list.children) li.classList.remove('selected');
    updateSelectedCount();
  });
  if (deleteAllBtn) deleteAllBtn.addEventListener('click', () => {
    const selectedDocs = getSelectedDocs();
    if (selectedDocs.length === 0) {
      toast('Please select documents to delete', 'warning');
      return;
    }
    showDeleteAllConfirmation(selectedDocs);
  });

  const docFilter = document.getElementById('docFilter');
  if (docFilter) docFilter.addEventListener('input', () => {
    const q = (docFilter.value || '').toLowerCase();
    const list = document.getElementById('docList');
    for (const li of list.children) {
      const name = (li.dataset.filename || li.textContent || '').toLowerCase();
      li.style.display = name.includes(q) ? '' : 'none';
    }
  });
}

// Set up upload functionality with drag and drop
function setupUploadFunctionality() {
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput');
  const uploadArea = document.querySelector('.group\\/upload');

  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', uploadFiles);
  }

  // Drag and drop functionality
  if (uploadArea) {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    uploadArea.addEventListener('drop', handleDrop, false);
  }
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight(e) {
  const uploadArea = document.querySelector('.group\\/upload');
  if (uploadArea) {
    uploadArea.classList.add('dragover');
  }
}

function unhighlight(e) {
  const uploadArea = document.querySelector('.group\\/upload');
  if (uploadArea) {
    uploadArea.classList.remove('dragover');
  }
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;

  if (files.length > 0) {
    // Show immediate feedback
    toast(`Processing ${files.length} dropped file(s)...`, 'info');

    const fileInput = document.getElementById('fileInput');
    fileInput.files = files;

    // Start upload after a brief delay to show the feedback
    setTimeout(() => {
      uploadFiles();
    }, 100);
  } else {
    toast('No valid files found in the dropped items', 'warning');
  }
}

window.addEventListener('DOMContentLoaded', main);

// Create podcast from text selection
async function createPodcastFromTextSelection() {
  if (!textSelectionInsights) {
    showNotification('No text selection insights available', 'error');
    return;
  }

  // Show podcast generation progress
  showPodcastGenerationProgress();

  try {
    const response = await fetch('/api/enhanced-podcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selected_text: textSelectionInsights.selected_text,
        related_insights: textSelectionInsights.insights || [],
        document: currentDoc || 'unknown',
        page_number: CURRENT_PAGE,
        conversation_style: 'academic',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // Hide progress and show success
    hidePodcastGenerationProgress();

    if (result.url) {
      showNotification('Podcast generated successfully!', 'success');
      loadAudio(result.url, `Podcast: ${textSelectionInsights.selected_text.substring(0, 50)}...`);
    } else {
      showNotification('Failed to generate podcast', 'error');
    }
  } catch (error) {
    console.error('Error creating podcast:', error);
    hidePodcastGenerationProgress();
    showNotification(`Error creating podcast: ${error.message}`, 'error');
  }
}

function showPodcastGenerationProgress() {
  // Create or show podcast progress modal
  let progressModal = document.getElementById('podcastProgressModal');
  if (!progressModal) {
    progressModal = document.createElement('div');
    progressModal.id = 'podcastProgressModal';
    progressModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    progressModal.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 class="text-xl font-semibold text-slate-800 dark:text-white mb-4">Generating Podcast...</h3>
          
          <!-- Progress Bar -->
          <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 mb-4">
            <div id="podcastProgress" class="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
          
          <div class="text-sm text-slate-600 dark:text-slate-400 mb-4">
            <div id="podcastStatus">Initializing podcast generation...</div>
          </div>
          
          <div class="text-xs text-slate-500 dark:text-slate-400">
            This may take a few minutes for high-quality audio
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(progressModal);
  }

  progressModal.classList.remove('hidden');

  // Simulate progress updates
  let progress = 0;
  const progressBar = document.getElementById('podcastProgress');
  const status = document.getElementById('podcastStatus');

  const progressInterval = setInterval(() => {
    progress += Math.random() * 8;
    if (progress > 85) progress = 85;

    if (progressBar) progressBar.style.width = progress + '%';
    if (status) {
      if (progress < 20) status.textContent = 'Analyzing selected text...';
      else if (progress < 40) status.textContent = 'Generating conversation script...';
      else if (progress < 60) status.textContent = 'Creating voice segments...';
      else if (progress < 80) status.textContent = 'Mixing audio...';
      else status.textContent = 'Finalizing podcast...';
    }
  }, 300);

  // Store interval for cleanup
  progressModal.dataset.progressInterval = progressInterval;
}

function hidePodcastGenerationProgress() {
  const progressModal = document.getElementById('podcastProgressModal');
  if (progressModal) {
    // Clear progress interval
    const interval = progressModal.dataset.progressInterval;
    if (interval) clearInterval(parseInt(interval));

    // Hide modal
    progressModal.classList.add('hidden');
  }
}

// Enhanced text selection event handler
function setupTextSelectionEvents() {
  if (!adobeViewer || !adobeApis) {
    console.log("Adobe viewer not ready, retrying in 1 second...");
    setTimeout(setupTextSelectionEvents, 1000);
    return;
  }

  try {
    // Enable text selection APIs
    if (adobeApis.enableTextSelection) {
      adobeApis.enableTextSelection();
    }

    console.log("✅ Text selection events configured successfully");
  } catch (error) {
    console.error("Error setting up text selection events:", error);
  }
}

// Text selection functions - defined here so they're available when buttons are clicked
function handleTextSelection(text, pageNumber) {
  console.log("Handling text selection:", text.substring(0, 100) + "...", "Page:", pageNumber);

  if (!text || text.trim().length < 10) {
    console.log("Text too short, ignoring selection");
    return;
  }

  // Store the selected text globally
  selectedText = text.trim();

  // Show loading state
  showTextSelectionLoading();

  // Call the text selection API
  fetch('/api/text-selection', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      selected_text: selectedText,
      document: currentDoc || 'unknown',
      page_number: pageNumber || CURRENT_PAGE,
      persona: '', // Will be filled from UI if available
      job: '',     // Will be filled from UI if available
    }),
  })
    .then(response => response.json())
    .then(data => {
      console.log("Text selection response:", data);
      textSelectionInsights = data;
      displayTextSelectionInsights(data);
    })
    .catch(error => {
      console.error('Error processing text selection:', error);
      showNotification(`Error processing text selection: ${error.message}`, 'error');
    });
}

function displayTextSelectionInsights(insights) {
  let panel = document.getElementById('textSelectionPanel');

  // Create panel if it doesn't exist
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'textSelectionPanel';
    panel.className = 'fixed top-20 right-4 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40 hidden';
    document.body.appendChild(panel);
  }

  // Clear any existing progress intervals
  const existingInterval = panel.dataset.progressInterval;
  if (existingInterval) {
    clearInterval(parseInt(existingInterval));
  }

  panel.innerHTML = `
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-slate-800 dark:text-white">Text Selection Insights</h3>
        <button onclick="clearTextSelection()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="mb-4">
        <div class="text-sm text-slate-600 dark:text-slate-400 mb-2">Selected Text:</div>
        <div class="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg text-sm text-slate-800 dark:text-slate-200">
          "${insights.selected_text.substring(0, 200)}${insights.selected_text.length > 200 ? '...' : ''}"
        </div>
      </div>
      
      ${insights.summary ? `
        <div class="mb-4">
          <div class="text-sm text-slate-600 dark:text-slate-400 mb-2">Summary:</div>
          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-slate-700 dark:text-slate-300">
            ${insights.summary}
          </div>
        </div>
      ` : ''}
      
      ${insights.insights && insights.insights.length > 0 ? `
        <div class="mb-4">
          <div class="text-sm text-slate-600 dark:text-slate-400 mb-2">Related Content (${insights.insights.length}):</div>
          <div class="space-y-2 max-h-40 overflow-y-auto">
            ${insights.insights.slice(0, 5).map((insight, idx) => `
              <div class="bg-slate-50 dark:bg-slate-800 p-2 rounded border-l-4 border-blue-500">
                <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  ${insight.document} (p.${insight.page_number}) - ${insight.insight_type}
                </div>
                <div class="text-sm text-slate-700 dark:text-slate-300">
                  ${insight.relevant_text.substring(0, 100)}${insight.relevant_text.length > 100 ? '...' : ''}
                </div>
                <button onclick="jumpToDocument('${insight.document}', ${insight.page_number})" 
                        class="mt-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                  Jump to this section →
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="flex space-x-2">
        <button onclick="getTextSelectionRecommendations()" 
                class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          Get Recommendations
        </button>
        <button onclick="createPodcastFromTextSelection()" 
                class="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          Create Podcast
        </button>
      </div>
    </div>
  `;

  panel.classList.remove('hidden');
}

function showNotification(message, type = 'info') {
  toast(message, type);
}

async function getTextSelectionRecommendations() {
  if (!textSelectionInsights || !textSelectionInsights.selected_text) return;

  const selectedText = textSelectionInsights.selected_text;
  if (!selectedText || selectedText.trim().length < 10) return;

  try {
    const response = await fetch('/api/document-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: selectedText,
        top_k: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const results = await response.json();

    // Update the recommendations panel with text-selection-based results
    displayTextSelectionRecommendations(results.results, selectedText);

  } catch (error) {
    console.error('Error getting text selection recommendations:', error);
    showNotification(`Error getting recommendations: ${error.message}`, 'error');
  }
}

function displayTextSelectionRecommendations(results, selectedText) {
  const panel = document.getElementById('textSelectionPanel');
  if (!panel) return;

  const recommendationsHtml = `
    <div class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-4 border-yellow-500">
      <div class="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
        Recommendations based on your selection:
      </div>
      <p class="text-xs text-slate-700 dark:text-slate-300 font-medium">"${selectedText.substring(0, 80)}${selectedText.length > 80 ? '...' : ''}"</p>
      
      ${results && results.length > 0 ? `
        <div class="mt-2 space-y-1">
          ${results.slice(0, 3).map((result, idx) => `
            <div class="text-xs text-slate-600 dark:text-slate-400">
              ${idx + 1}. ${result.document} (p.${result.page_number}) - ${result.text.substring(0, 60)}...
            </div>
          `).join('')}
        </div>
      ` : '<div class="text-xs text-slate-500 dark:text-slate-400 mt-1">No specific recommendations found.</div>'}
    </div>
  `;

  // Add recommendations to the existing panel
  const existingContent = panel.querySelector('.flex.space-x-2');
  if (existingContent) {
    existingContent.insertAdjacentHTML('beforebegin', recommendationsHtml);
  }
}

function hideTextSelectionUI() {
  const insightsPanel = document.getElementById('textSelectionPanel');
  if (insightsPanel) {
    insightsPanel.classList.add('hidden');
  }

  // Clear global variables
  selectedText = "";
  textSelectionInsights = null;
}

function clearTextSelection() {
  hideTextSelectionUI();
  toast('Text selection cleared', 'info');
}

function jumpToDocument(documentName, pageNumber) {
  if (!documentName) {
    showNotification('Document name not available', 'error');
    return;
  }

  // Load the document if not already loaded
  if (currentDoc !== `/files/${documentName}`) {
    initAdobeView(`/files/${documentName}`).then(() => {
      // Wait for viewer to initialize, then jump to page
      setTimeout(() => {
        jumpToPage(pageNumber || 1);
      }, 1000);
    });
  } else {
    // Document already loaded, jump directly to page
    jumpToPage(pageNumber || 1);
  }

  // Hide the text selection panel after jumping
  hideTextSelectionUI();
}

function loadAudio(url, title = 'Audio') {
  const player = document.getElementById('player');
  if (player) {
    player.src = url;
    player.setAttribute('title', title);
    player.play().catch(e => console.log('Auto-play prevented:', e));
    toast(`Loading audio: ${title}`, 'info');
  } else {
    // Fallback: create a new audio element
    const audio = new Audio(url);
    audio.title = title;
    audio.play().catch(e => console.log('Auto-play prevented:', e));
    toast(`Playing audio: ${title}`, 'info');
  }
}

async function getDocumentRecommendations() {
  if (!currentDoc) return;

  try {
    const filename = currentDoc.split('/').pop();
    const response = await fetch(`/api/index/recommendations/${encodeURIComponent(filename)}?top_k=5`);

    if (response.ok) {
      const recommendations = await response.json();
      console.log('Document recommendations:', recommendations);
      // You can display these recommendations in the UI if needed
    }
  } catch (error) {
    console.error('Error getting document recommendations:', error);
  }
}

function showTextInputModal() {
  // Create a modern modal overlay
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.id = 'textInputModal';

  // Get the current page number more reliably
  const currentPage = Math.max(1, CURRENT_PAGE || 1);
  console.log('Current page for modal:', currentPage);

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 transform transition-all">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
            <i class="fas fa-highlighter text-white text-lg"></i>
          </div>
          <div>
            <h3 class="text-xl font-bold text-slate-800 dark:text-white">Text Selection Analysis</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">Enter the text you want to analyze</p>
          </div>
        </div>
        <button onclick="closeTextInputModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      
      <!-- Content -->
      <div class="p-6">
        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Selected Text from PDF
          </label>
          <textarea 
            id="textInputArea" 
            placeholder="Paste or type the text you selected from the PDF here... (10+ characters suggested for better analysis)"
            class="w-full h-32 p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-200 resize-none"
          ></textarea>
          <div class="flex items-center justify-end mt-2">
            <span class="text-xs text-slate-500 dark:text-slate-400">
              Suggested: 10+ characters for better analysis
            </span>
          </div>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Page Number (Optional)
          </label>
          <input 
            type="number" 
            id="pageInput" 
            min="1" 
            value="${currentPage}"
            class="w-24 p-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-slate-200"
          >
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Current page: ${currentPage}
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="flex items-center justify-end space-x-3 p-6 border-t border-slate-200 dark:border-slate-700">
        <button 
          onclick="closeTextInputModal()" 
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button 
          id="analyzeTextBtn"
          onclick="analyzeSelectedText()" 
          class="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
        >
          <i class="fas fa-search mr-2"></i>Analyze Text
        </button>
      </div>
    </div>
  `;

  // Add modal to DOM first
  document.body.appendChild(modal);

  // Initialize character counter with multiple strategies and better timing
  initializeCharacterCounter(modal);

  // Close modal on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeTextInputModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

// Separate function to initialize character counter with better error handling
function initializeCharacterCounter(modal) {
  // Prevent multiple initializations
  if (modal.dataset.counterInitialized === 'true') {
    console.log('Character counter already initialized, skipping...');
    return;
  }

  modal.dataset.counterInitialized = 'true';

  // Try multiple times to initialize the counter
  let attempts = 0;
  const maxAttempts = 3;

  function tryInitialize() {
    attempts++;
    console.log(`Attempting to initialize character counter (attempt ${attempts})`);

    const textArea = document.getElementById('textInputArea');
    const analyzeBtn = document.getElementById('analyzeTextBtn');

    if (!textArea || !analyzeBtn) {
      console.log('Elements not found, retrying...');
      if (attempts < maxAttempts) {
        setTimeout(tryInitialize, 300);
      } else {
        console.error('Failed to initialize character counter after multiple attempts');
      }
      return;
    }

    console.log('Elements found, initializing character counter...');

    // Always ensure the analyze button is enabled
    function ensureButtonEnabled() {
      try {
        // Always enable analyze button regardless of text length
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        console.log('Analyze button enabled');
      } catch (error) {
        console.error('Error in ensureButtonEnabled:', error);
      }
    }

    // Strategy 1: Simple input event listener (most reliable)
    textArea.addEventListener('input', ensureButtonEnabled);
    console.log('Added input event listener');

    // Strategy 2: Paste event listener
    textArea.addEventListener('paste', ensureButtonEnabled);
    console.log('Added paste event listener');

    // Strategy 3: Keyup event listener for immediate feedback
    textArea.addEventListener('keyup', ensureButtonEnabled);
    console.log('Added keyup event listener');

    // Strategy 4: Change event listener
    textArea.addEventListener('change', ensureButtonEnabled);
    console.log('Added change event listener');

    // Strategy 5: Focus event to update on focus
    textArea.addEventListener('focus', ensureButtonEnabled);
    console.log('Added focus event listener');

    // Initial button state - always enabled
    ensureButtonEnabled();

    // Focus on text area
    textArea.focus();

    console.log('Character counter initialized successfully');

    // Verify the button is enabled
    setTimeout(() => {
      console.log('Verification - Button disabled:', analyzeBtn.disabled);
    }, 200);

  } // end of tryInitialize function

  // Start initialization with a delay to ensure DOM is ready
  setTimeout(tryInitialize, 200);
}

function closeTextInputModal() {
  const modal = document.getElementById('textInputModal');
  console.log('Attempting to close modal:', modal);

  if (modal) {
    // Reset initialization flag
    modal.dataset.counterInitialized = 'false';
    console.log('Reset counter initialization flag');

    // Remove the modal
    modal.remove();
    console.log('Modal removed from DOM');
  } else {
    console.error('Modal element not found for closing');
  }
}

function analyzeSelectedText() {
  const textArea = document.getElementById('textInputArea');
  const pageInput = document.getElementById('pageInput');

  const selectedText = textArea.value.trim();
  const pageNumber = parseInt(pageInput.value) || CURRENT_PAGE || 1;

  if (selectedText.length === 0) {
    toast('Please enter some text to analyze.', 'warning');
    return;
  }

  if (selectedText.length < 10) {
    toast('Short text detected. For better analysis, consider entering 10+ characters.', 'info');
  }

  // Close modal
  closeTextInputModal();

  // Process the text selection
  handleTextSelection(selectedText, pageNumber);
}

async function updateCurrentPageFromViewer() {
  if (!adobeViewer) {
    console.log('No Adobe viewer available for page detection');
    return;
  }

  try {
    const apis = await adobeViewer.getAPIs();
    if (apis && apis.getCurrentPage) {
      const currentPage = await apis.getCurrentPage();
      if (currentPage && typeof currentPage === 'number') {
        const oldPage = CURRENT_PAGE;
        CURRENT_PAGE = Math.max(1, currentPage);
        console.log(`Updated current page from viewer: ${oldPage} -> ${CURRENT_PAGE}`);
      }
    } else if (apis && apis.getPageZoom) {
      // Alternative: try to get page info from zoom APIs
      console.log('getCurrentPage not available, trying alternative methods');
    }
  } catch (error) {
    console.log('Could not get current page from viewer:', error);
  }
}

// Test function to verify character counter is working
function testCharCounter() {
  const textArea = document.getElementById('textInputArea');
  const charCount = document.getElementById('charCount');
  const analyzeBtn = document.getElementById('analyzeTextBtn');

  if (!textArea || !charCount || !analyzeBtn) {
    alert('Elements not found!');
    return;
  }

  console.log('=== CHARACTER COUNTER TEST ===');
  console.log('Text area element:', textArea);
  console.log('Character count element:', charCount);
  console.log('Analyze button:', analyzeBtn);
  console.log('Text area value before test:', textArea.value);
  console.log('Character count before test:', charCount.textContent);
  console.log('Button disabled before test:', analyzeBtn.disabled);

  // Test with some sample text
  const testText = 'This is a test message with 35 characters!';

  console.log('Setting text area value to:', testText);
  textArea.value = testText;

  console.log('Text area value after setting:', textArea.value);
  console.log('Text area length after setting:', textArea.value.length);

  // Force update the counter immediately
  charCount.textContent = textArea.value.length;
  console.log('Manually updated counter to:', charCount.textContent);

  // Update button state
  if (textArea.value.length >= 10) {
    analyzeBtn.disabled = false;
    analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    console.log('Button enabled');
  } else {
    analyzeBtn.disabled = true;
    analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
    console.log('Button disabled');
  }

  // Test if events are working by dispatching an input event
  console.log('Testing input event...');
  const inputEvent = new Event('input', { bubbles: true });
  textArea.dispatchEvent(inputEvent);

  // Wait a moment for events to process
  setTimeout(() => {
    console.log('=== AFTER EVENT TEST ===');
    console.log('Text area value:', textArea.value);
    console.log('Text area length:', textArea.value.length);
    console.log('Counter shows:', charCount.textContent);
    console.log('Button disabled:', analyzeBtn.disabled);

    // Show current state
    alert(`Test Results:\n\nText area value: "${textArea.value}"\nLength: ${textArea.value.length}\nCounter shows: ${charCount.textContent}\nButton disabled: ${analyzeBtn.disabled}\n\nCheck console for detailed logs.`);
  }, 100);
}

// Manual refresh function for character counter
function refreshCharCounter() {
  const textArea = document.getElementById('textInputArea');
  const charCount = document.getElementById('charCount');
  const analyzeBtn = document.getElementById('analyzeTextBtn');

  if (!textArea || !charCount || !analyzeBtn) {
    console.error('Elements not found for refresh');
    return;
  }

  console.log('=== REFRESHING CHARACTER COUNTER ===');
  console.log('Current text area value:', textArea.value);
  console.log('Current text area length:', textArea.value.length);

  // Force update the counter
  const length = textArea.value.length;
  charCount.textContent = length;
  console.log('Updated counter to:', length);

  // Update button state
  if (length >= 10) {
    analyzeBtn.disabled = false;
    analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    console.log('Button enabled');
  } else {
    analyzeBtn.disabled = true;
    analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
    console.log('Button disabled');
  }

  // Reinstall event listeners on the existing textarea
  try {
    // Remove existing listeners by cloning the textarea
    const newTextArea = textArea.cloneNode(true);
    newTextArea.value = textArea.value;

    // Add our event listeners
    newTextArea.addEventListener('input', () => {
      const len = newTextArea.value.length;
      charCount.textContent = len;
      if (len >= 10) {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        analyzeBtn.disabled = true;
        analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });

    newTextArea.addEventListener('paste', () => {
      const len = newTextArea.value.length;
      charCount.textContent = len;
      if (len >= 10) {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        analyzeBtn.disabled = true;
        analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });

    newTextArea.addEventListener('keyup', () => {
      const len = newTextArea.value.length;
      charCount.textContent = len;
      if (len >= 10) {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        analyzeBtn.disabled = true;
        analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });

    newTextArea.addEventListener('change', () => {
      const len = newTextArea.value.length;
      charCount.textContent = len;
      if (len >= 10) {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        analyzeBtn.disabled = true;
        analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });

    newTextArea.addEventListener('focus', () => {
      const len = newTextArea.value.length;
      charCount.textContent = len;
      if (len >= 10) {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        analyzeBtn.disabled = true;
        analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });

    // Replace the old textarea
    textArea.parentNode.replaceChild(newTextArea, textArea);

    // Focus on the new textarea
    newTextArea.focus();

    console.log('Reinitialized event listeners with new textarea');
  } catch (error) {
    console.log('Failed to reinitialize event listeners:', error);
  }

  console.log('Refresh complete');
}

// Global function to force refresh character counter (useful for debugging)
function forceRefreshCharCounter() {
  console.log('=== FORCE REFRESH CHARACTER COUNTER ===');

  const textArea = document.getElementById('textInputArea');
  const charCount = document.getElementById('charCount');
  const analyzeBtn = document.getElementById('analyzeTextBtn');

  if (!textArea || !charCount || !analyzeBtn) {
    console.log('Modal not open, cannot refresh counter');
    return false;
  }

  // Force update
  const length = textArea.value.length;
  charCount.textContent = length;

  // Update button state
  if (length >= 10) {
    analyzeBtn.disabled = false;
    analyzeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  } else {
    analyzeBtn.disabled = true;
    analyzeBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }

  console.log(`Forced refresh: ${length} characters, button ${analyzeBtn.disabled ? 'disabled' : 'enabled'}`);
  return true;
}

// Function to check for Adobe viewer interference
function checkAdobeViewerInterference() {
  console.log('=== CHECKING ADOBE VIEWER INTERFERENCE ===');

  const interference = {
    adobeViewerExists: !!window.adobeViewer,
    adobeViewExists: !!window.adobeView,
    currentDoc: !!currentDoc,
    modalOpen: !!document.getElementById('textInputModal'),
    textAreaExists: !!document.getElementById('textInputArea'),
    charCountExists: !!document.getElementById('charCount')
  };

  console.log('Interference check results:', interference);

  if (interference.adobeViewerExists) {
    console.log('Adobe viewer is active, this might interfere with DOM events');

    // Check if the viewer is in an iframe
    try {
      const viewerContainer = document.getElementById('adobe-dc-view');
      if (viewerContainer) {
        const iframes = viewerContainer.querySelectorAll('iframe');
        console.log('Adobe viewer iframes found:', iframes.length);

        iframes.forEach((iframe, index) => {
          console.log(`Iframe ${index}:`, {
            src: iframe.src,
            contentWindow: !!iframe.contentWindow,
            contentDocument: !!iframe.contentDocument
          });
        });
      }
    } catch (error) {
      console.log('Could not inspect Adobe viewer iframes:', error);
    }
  }

  if (interference.modalOpen && interference.textAreaExists) {
    const textArea = document.getElementById('textInputArea');
    const charCount = document.getElementById('charCount');

    console.log('Text area value:', textArea.value);
    console.log('Text area length:', textArea.value.length);
    console.log('Character count shows:', charCount.textContent);

    // Check if the textarea has our custom value setter
    try {
      const descriptor = Object.getOwnPropertyDescriptor(textArea, 'value');
      console.log('Textarea value property descriptor:', descriptor);

      if (descriptor && descriptor.set) {
        console.log('Custom value setter is installed');
      } else {
        console.log('No custom value setter found');
      }
    } catch (error) {
      console.log('Could not check value property descriptor:', error);
    }

    // Check if events are working
    const testEvent = new Event('input', { bubbles: true });
    textArea.dispatchEvent(testEvent);

    setTimeout(() => {
      console.log('After test event - Text area length:', textArea.value.length);
      console.log('After test event - Character count shows:', charCount.textContent);

      // Test if our custom setter is working
      console.log('Testing custom setter...');
      const originalValue = textArea.value;
      textArea.value = 'Test interference check';

      setTimeout(() => {
        console.log('After custom setter test:');
        console.log('Text area value:', textArea.value);
        console.log('Character count shows:', charCount.textContent);

        // Restore original value
        textArea.value = originalValue;
      }, 100);
    }, 100);
  }

  return interference;
}

// Force fix function for character counter when Adobe viewer interference is detected
function forceFixCharacterCounter() {
  console.log('=== FORCE FIXING CHARACTER COUNTER ===');

  const modal = document.getElementById('textInputModal');
  if (!modal) {
    console.log('Modal not open, cannot force fix');
    return;
  }

  // Reset the initialization flag
  modal.dataset.counterInitialized = 'false';

  // Clear any existing intervals
  const pollInterval = modal.dataset.pollInterval;
  if (pollInterval) {
    clearInterval(parseInt(pollInterval));
    console.log('Cleared existing poll interval');
  }

  // Force reinitialize the character counter
  console.log('Reinitializing character counter...');
  initializeCharacterCounter(modal);

  // Also force a manual refresh
  setTimeout(() => {
    refreshCharCounter();
  }, 200);

  console.log('Force fix complete');
}

// Add to global scope for debugging
window.forceRefreshCharCounter = forceRefreshCharCounter;
window.testCharCounter = testCharCounter;
window.refreshCharCounter = refreshCharCounter;
window.checkAdobeViewerInterference = checkAdobeViewerInterference;
window.forceFixCharacterCounter = forceFixCharacterCounter;

// Initialize audio player controls
let audioPlayerInitialized = false;

// Function to reset audio player initialization (useful when loading new audio)
function resetAudioPlayerInitialization() {
  audioPlayerInitialized = false;
}

function initializeAudioPlayer() {
  // Prevent multiple initializations
  if (audioPlayerInitialized) {
    console.log('Audio player already initialized, skipping...');
    return;
  }

  const player = document.getElementById('player');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const audioProgress = document.getElementById('audioProgress');
  const progressContainer = document.getElementById('progressContainer');
  const currentTime = document.getElementById('currentTime');
  const totalTime = document.getElementById('totalTime');
  const audioInfo = document.getElementById('audioInfo');
  const audioTitle = document.getElementById('audioTitle');
  const speedBtn = document.getElementById('speedBtn');
  const speedMenu = document.getElementById('speedMenu');

  if (!player || !playPauseBtn || !stopBtn) {
    console.log('Audio player elements not found');
    return;
  }

  // Mark as initialized to prevent duplicate calls
  audioPlayerInitialized = true;

  // Get the current player reference
  const currentPlayer = player;

  // Format time helper function
  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Update progress bar and time display
  function updateProgress() {
    if (currentPlayer.duration && !isNaN(currentPlayer.duration)) {
      const progress = (currentPlayer.currentTime / currentPlayer.duration) * 100;
      if (audioProgress) audioProgress.style.width = progress + '%';
      if (currentTime) currentTime.textContent = formatTime(currentPlayer.currentTime);
      if (totalTime) totalTime.textContent = formatTime(currentPlayer.duration);
    }
  }

  // Update play/pause button icon
  function updatePlayPauseIcon() {
    const icon = playPauseBtn.querySelector('i');
    if (icon) {
      if (currentPlayer.paused) {
        icon.className = 'fas fa-play text-sm';
      } else {
        icon.className = 'fas fa-pause text-sm';
      }
    }
  }

  // Show audio info
  function showAudioInfo() {
    if (audioInfo && audioTitle) {
      audioInfo.classList.remove('hidden');
      audioTitle.textContent = currentPlayer.title || 'AI Podcast';
    }
  }

  // Hide audio info
  function hideAudioInfo() {
    if (audioInfo) audioInfo.classList.add('hidden');
    if (audioTitle) audioTitle.textContent = 'No audio loaded';
  }

  // Play/Pause button click handler
  playPauseBtn.addEventListener('click', () => {
    if (currentPlayer.paused) {
      // Only show error toast if the play actually fails and it's not a user-initiated pause
      currentPlayer.play().catch(e => {
        console.log('Play failed:', e);
        // Only show error if it's a genuine failure, not just a user pause
        if (e.name !== 'AbortError' && !currentPlayer.paused) {
          toast('Failed to play audio. Please try again.', 'error');
        }
      });
    } else {
      currentPlayer.pause();
    }
  });

  // Stop button click handler
  stopBtn.addEventListener('click', () => {
    currentPlayer.pause();
    currentPlayer.currentTime = 0;
    updateProgress();
    updatePlayPauseIcon();
  });

  // Progress bar seeking functionality
  if (progressContainer) {
    progressContainer.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Check if audio is ready for seeking
      if (!currentPlayer.duration || isNaN(currentPlayer.duration) || currentPlayer.readyState < 1) {
        console.log('Audio not ready for seeking yet');
        toast('Audio is still loading. Please wait a moment before seeking.', 'info');
        return;
      }

      const rect = progressContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const percentage = clickX / width;

      // Ensure percentage is within valid range
      const clampedPercentage = Math.max(0, Math.min(1, percentage));

      // Store current playback state
      const wasPlaying = !currentPlayer.paused;

      // Seek to the new position
      const newTime = clampedPercentage * currentPlayer.duration;

      // Ensure the seek operation completes before resuming
      currentPlayer.currentTime = newTime;

      // Update progress immediately
      updateProgress();

      // Resume playback if it was playing before
      if (wasPlaying) {
        // Add a small delay to ensure the seek operation completes
        setTimeout(() => {
          currentPlayer.play().catch(e => {
            console.log('Failed to resume playback after seek:', e);
            // Don't show error toast for seek failures as they're usually temporary
          });
        }, 100);
      }

      console.log(`Seeked to ${clampedPercentage * 100}% (${currentPlayer.currentTime}s / ${currentPlayer.duration}s)`);
    });
  }

  // Show progress handle on hover
  progressContainer.addEventListener('mouseenter', () => {
    const handle = document.getElementById('progressHandle');
    if (handle) handle.style.opacity = '1';
  });

  progressContainer.addEventListener('mouseleave', () => {
    const handle = document.getElementById('progressHandle');
    if (handle) handle.style.opacity = '0';
  });

  // Playback speed controls - cycling through speeds
  if (speedBtn) {
    const speeds = [1, 1.25, 1.5, 1.75, 2.0];
    let currentSpeedIndex = 0;

    speedBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Cycle to next speed
      currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
      const newSpeed = speeds[currentSpeedIndex];

      // Apply the new speed
      currentPlayer.playbackRate = newSpeed;
      speedBtn.textContent = newSpeed + 'x';

      console.log(`Playback speed set to ${newSpeed}x`);

      // Show feedback
      toast(`Speed: ${newSpeed}x`, 'info');
    });
  }

  // Audio event listeners
  currentPlayer.addEventListener('loadedmetadata', () => {
    console.log('Audio metadata loaded');
    updateProgress();
    showAudioInfo();
  });

  currentPlayer.addEventListener('timeupdate', updateProgress);

  currentPlayer.addEventListener('play', () => {
    console.log('Audio started playing');
    updatePlayPauseIcon();
    showAudioInfo();
  });

  currentPlayer.addEventListener('pause', () => {
    console.log('Audio paused');
    updatePlayPauseIcon();
  });

  currentPlayer.addEventListener('ended', () => {
    console.log('Audio ended');
    updatePlayPauseIcon();
    currentPlayer.currentTime = 0;
    updateProgress();
  });

  currentPlayer.addEventListener('error', (e) => {
    console.error('Audio error:', e);
    // Only show error toast for genuine errors, not user-initiated actions
    if (e.target.error && e.target.error.code !== 20) { // Code 20 is usually user abort
      toast('Audio playback error. Please try again.', 'error');
      hideAudioInfo();
    }
  });

  currentPlayer.addEventListener('loadstart', () => {
    console.log('Audio loading started');
    if (audioTitle) audioTitle.textContent = 'Loading...';
  });

  currentPlayer.addEventListener('canplay', () => {
    console.log('Audio can start playing');
  });

  // Initial state
  updateProgress();
  updatePlayPauseIcon();
  hideAudioInfo();

  console.log('Audio player initialized with seeking and speed controls');
}

// Initialize audio player when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeAudioPlayer();
});

// Delete document functionality
async function deleteDocument(filename) {
  // Show confirmation modal
  showDeleteConfirmation(filename);
}

function showDeleteConfirmation(filename) {
  // Create confirmation modal
  const modal = document.createElement('div');
  modal.id = 'deleteConfirmationModal';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
            <i class="fas fa-exclamation-triangle text-white text-lg"></i>
          </div>
          <div>
            <h3 class="text-xl font-bold text-slate-800 dark:text-white">Delete Document</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">This action cannot be undone</p>
          </div>
        </div>
      </div>
      
      <!-- Content -->
      <div class="p-6">
        <div class="mb-4">
          <p class="text-slate-700 dark:text-slate-300 mb-2">
            Are you sure you want to delete this document?
          </p>
          <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border-l-4 border-red-500">
            <div class="flex items-center space-x-2">
              <i class="fas fa-file-pdf text-red-500"></i>
              <span class="text-sm font-medium text-red-800 dark:text-red-200">${filename}</span>
            </div>
          </div>
        </div>
        
        <div class="text-sm text-slate-600 dark:text-slate-400">
          <p>This will permanently remove the file from the system and cannot be recovered.</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="flex items-center justify-end space-x-3 p-6 border-t border-slate-200 dark:border-slate-700">
        <button 
          onclick="closeDeleteConfirmation()" 
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button 
          onclick="confirmDeleteDocument('${filename}')" 
          class="px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
        >
          <i class="fas fa-trash mr-2"></i>Delete
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close modal on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeDeleteConfirmation();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function closeDeleteConfirmation() {
  const modal = document.getElementById('deleteConfirmationModal');
  if (modal) {
    modal.remove();
  }
}

async function confirmDeleteDocument(filename) {
  try {
    // Show loading state
    const deleteBtn = document.querySelector('#deleteConfirmationModal button:last-child');
    const originalContent = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = `
      <div class="flex items-center space-x-2">
        <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        <span>Deleting...</span>
      </div>
    `;

    // Call delete API
    const response = await fetch(`/api/documents/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      // Close confirmation modal
      closeDeleteConfirmation();

      // Show success message
      toast(`Successfully deleted "${filename}"`, 'success');

      // Reload documents list
      await loadDocuments();

      // If the deleted document was currently loaded, clear the viewer
      if (currentDoc === `/files/${filename}`) {
        currentDoc = null;
        const container = document.getElementById('adobe-dc-view');
        if (container) {
          container.innerHTML = '';
        }
        updateCurrentDocName();
      }
    } else {
      throw new Error(result.error || 'Delete failed');
    }

  } catch (error) {
    console.error('Delete error:', error);
    toast(`Failed to delete "${filename}": ${error.message}`, 'error');

    // Restore button state
    const deleteBtn = document.querySelector('#deleteConfirmationModal button:last-child');
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.innerHTML = `
        <i class="fas fa-trash mr-2"></i>Delete
      `;
    }
  }
}

// Bulk delete functionality
function showDeleteAllConfirmation(selectedDocs) {
  // Create confirmation modal
  const modal = document.createElement('div');
  modal.id = 'deleteAllConfirmationModal';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
            <i class="fas fa-exclamation-triangle text-white text-lg"></i>
          </div>
          <div>
            <h3 class="text-xl font-bold text-slate-800 dark:text-white">Delete Multiple Documents</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">This action cannot be undone</p>
          </div>
        </div>
      </div>
      
      <!-- Content -->
      <div class="p-6">
        <div class="mb-4">
          <p class="text-slate-700 dark:text-slate-300 mb-2">
            Are you sure you want to delete ${selectedDocs.length} selected document${selectedDocs.length > 1 ? 's' : ''}?
          </p>
          <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border-l-4 border-red-500 max-h-32 overflow-y-auto">
            ${selectedDocs.map(filename => `
              <div class="flex items-center space-x-2 mb-1">
                <i class="fas fa-file-pdf text-red-500 text-xs"></i>
                <span class="text-sm text-red-800 dark:text-red-200">${filename}</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="text-sm text-slate-600 dark:text-slate-400">
          <p>This will permanently remove all selected files from the system and cannot be recovered.</p>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="flex items-center justify-end space-x-3 p-6 border-t border-slate-200 dark:border-slate-700">
        <button 
          onclick="closeDeleteAllConfirmation()" 
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button 
          onclick="confirmDeleteAllDocuments(${JSON.stringify(selectedDocs).replace(/"/g, '&quot;')})" 
          class="px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
        >
          <i class="fas fa-trash mr-2"></i>Delete 
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close modal on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeDeleteAllConfirmation();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function closeDeleteAllConfirmation() {
  const modal = document.getElementById('deleteAllConfirmationModal');
  if (modal) {
    modal.remove();
  }
}

async function confirmDeleteAllDocuments(selectedDocs) {
  try {
    // Show loading state
    const deleteBtn = document.querySelector('#deleteAllConfirmationModal button:last-child');
    const originalContent = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = `
      <div class="flex items-center space-x-2">
        <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        <span>Deleting...</span>
      </div>
    `;

    // Delete selected documents
    const deletePromises = selectedDocs.map(filename =>
      fetch(`/api/documents/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })
    );

    const results = await Promise.allSettled(deletePromises);

    // Count successful and failed deletions
    const successful = results.filter(result => result.status === 'fulfilled' && result.value.ok).length;
    const failed = results.length - successful;

    // Close confirmation modal
    closeDeleteAllConfirmation();

    // Show results
    if (successful > 0) {
      toast(`Successfully deleted ${successful} document${successful > 1 ? 's' : ''}`, 'success');
    }

    if (failed > 0) {
      toast(`Failed to delete ${failed} document${failed > 1 ? 's' : ''}`, 'error');
    }

    // Reload documents list
    await loadDocuments();

    // Clear current document if it was deleted
    const deletedFilenames = selectedDocs.map(filename => `/files/${filename}`);
    if (deletedFilenames.includes(currentDoc)) {
      currentDoc = null;
      const container = document.getElementById('adobe-dc-view');
      if (container) {
        container.innerHTML = '';
      }
      updateCurrentDocName();
    }

  } catch (error) {
    console.error('Bulk delete error:', error);
    toast(`Failed to delete documents: ${error.message}`, 'error');

    // Restore button state
    const deleteBtn = document.querySelector('#deleteAllConfirmationModal button:last-child');
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.innerHTML = `
        <i class="fas fa-trash mr-2"></i>Delete 
      `;
    }
  }
}
