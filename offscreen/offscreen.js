// Receives screenshots from background, stitches them into a PDF, returns base64 PDF

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "STITCH_PDF") return;

  stitchPdf(msg.screenshots, msg.viewportWidth, msg.viewportHeight, msg.lastSliceHeight)
    .then(base64 => sendResponse({ success: true, base64 }))
    .catch(err => sendResponse({ success: false, error: err.message }));

  return true; // keep channel open
});

async function stitchPdf(screenshots, vpWidth, vpHeight, lastSliceHeight) {
  // Load each screenshot into an Image element to get actual pixel dimensions
  const images = await Promise.all(screenshots.map(src => loadImage(src)));

  // PDF page size in pts (1pt = 1/72 inch). Use 96 DPI screen assumption.
  const PX_TO_PT = 72 / 96;
  const pageW = vpWidth * PX_TO_PT;
  const pageH = vpHeight * PX_TO_PT;

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: pageW > pageH ? "landscape" : "portrait",
    unit: "pt",
    format: [pageW, pageH]
  });

  for (let i = 0; i < images.length; i++) {
    if (i > 0) pdf.addPage([pageW, pageH]);

    const img = images[i];
    const isLast = i === images.length - 1;

    if (isLast && lastSliceHeight > 0 && lastSliceHeight < vpHeight) {
      // Last slice may be shorter — crop it so the page height matches
      const croppedDataUrl = cropImageBottom(img, vpWidth, lastSliceHeight);
      const croppedPt = lastSliceHeight * PX_TO_PT;
      pdf.internal.pageSize.setHeight(croppedPt);
      pdf.addImage(croppedDataUrl, "JPEG", 0, 0, pageW, croppedPt);
    } else {
      pdf.addImage(img.src, "JPEG", 0, 0, pageW, pageH);
    }
  }

  return pdf.output("datauristring").split(",")[1]; // base64 only
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function cropImageBottom(img, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.92);
}
