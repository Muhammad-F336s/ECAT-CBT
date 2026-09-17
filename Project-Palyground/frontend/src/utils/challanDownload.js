import API from "./api";

/**
 * Universal Centralized Challan PDF Downloader.
 * Used across Student Portal (PackagesPage) and Admin Workspace (AdminPayments).
 */
export const downloadChallanPdf = async (orderId, refCode) => {
  try {
    const res = await API.get(`/payment/challan/${orderId}/pdf`, {
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Entrace-Challan-${refCode || orderId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("[ChallanDownload] PDF download error:", err);
    throw new Error("Failed to download Challan PDF. Please try again.");
  }
};
