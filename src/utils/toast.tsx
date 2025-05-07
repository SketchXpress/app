import { toast, ToastOptions } from "react-toastify";

// Default toast configuration
const defaultOptions: ToastOptions = {
  position: "bottom-left",
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

// Themed toast options with SketchXpress styling
const successOptions: ToastOptions = {
  ...defaultOptions,
  style: {
    background: "linear-gradient(to right, #E1F8FF, #F2FFFC)",
    color: "#00B7E1",
    borderLeft: "4px solid #00B7E1",
    fontWeight: "500",
  },
};

const errorOptions: ToastOptions = {
  ...defaultOptions,
  autoClose: 4000, // Give users more time to read errors
  style: {
    background: "linear-gradient(to right, #FFE6E6, #FFF0F0)",
    color: "#EF4444",
    borderLeft: "4px solid #EF4444",
    fontWeight: "500",
  },
};

const warningOptions: ToastOptions = {
  ...defaultOptions,
  style: {
    background: "linear-gradient(to right, #FFF8E1, #FFFDF2)",
    color: "#F59E0B",
    borderLeft: "4px solid #F59E0B",
    fontWeight: "500",
  },
};

const infoOptions: ToastOptions = {
  ...defaultOptions,
  style: {
    background: "linear-gradient(to right, #E6F4FF, #F0F7FF)",
    color: "#3B82F6",
    borderLeft: "4px solid #3B82F6",
    fontWeight: "500",
  },
};

// Toast functions with custom styling
export const showSuccess = (message: string, options?: ToastOptions) => {
  return toast.success(message, { ...successOptions, ...options });
};

export const showError = (message: string, options?: ToastOptions) => {
  return toast.error(message, { ...errorOptions, ...options });
};

export const showWarning = (message: string, options?: ToastOptions) => {
  return toast.warning(message, { ...warningOptions, ...options });
};

export const showInfo = (message: string, options?: ToastOptions) => {
  return toast.info(message, { ...infoOptions, ...options });
};

// For loading toast with promise
export const showLoadingToast = (
  promise: Promise<unknown>,
  options: {
    pending: string;
    success: string;
    error: string;
  }
) => {
  return toast.promise(
    promise,
    {
      pending: options.pending,
      success: options.success,
      error: options.error,
    },
    {
      ...defaultOptions,
      autoClose: false,
    }
  );
};

// Export convenience method (direct access to toast)
export { toast };
