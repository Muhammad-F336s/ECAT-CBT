// DOM Elements
const signUpButton = document.getElementById("signUpBtn");
const signInButton = document.getElementById("signInBtn");
const container = document.getElementById("container");
const signInForm = document.getElementById("signInForm");
const signUpForm = document.getElementById("signUpForm");
const toast = document.getElementById("toast");

// Desktop Sliding Interactions
if (signUpButton && signInButton && container) {
  signUpButton.addEventListener("click", () => {
    container.classList.add("right-panel-active");
  });

  signInButton.addEventListener("click", () => {
    container.classList.remove("right-panel-active");
  });
}

// Password Visibility Toggle
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const svg = btn.querySelector("svg");

  if (input.type === "password") {
    input.type = "text";

    // Add a diagonal slash line to the eye icon to represent hidden/visible toggle state
    let line = svg.querySelector("line");
    if (!line) {
      line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", "2");
      line.setAttribute("y1", "2");
      line.setAttribute("x2", "22");
      line.setAttribute("y2", "22");
      line.setAttribute("stroke", "currentColor");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-linecap", "round");
      svg.appendChild(line);
    }
  } else {
    input.type = "password";
    const line = svg.querySelector("line");
    if (line) {
      line.remove();
    }
  }
}

// Toast Notification System
function showToast(message, type = "success") {
  if (!toast) return;

  toast.textContent = message;
  toast.className = "toast show " + type;

  // Clear previous timeouts if rapidly clicking
  if (window.toastTimeout) {
    clearTimeout(window.toastTimeout);
  }

  window.toastTimeout = setTimeout(() => {
    toast.className = "toast";
  }, 4000);
}

// Form Validation and Action Handlers
if (signInForm) {
  signInForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("signInEmail");
    const passwordInput = document.getElementById("signInPassword");

    if (!emailInput.value || !passwordInput.value) {
      showToast("Please fill out all fields.", "error");
      return;
    }

    // Simulate Login
    showToast("Successfully logged into ECAT Portal!", "success");

    // Reset form
    signInForm.reset();
  });
}

if (signUpForm) {
  signUpForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("signUpName");
    const emailInput = document.getElementById("signUpEmail");
    const passwordInput = document.getElementById("signUpPassword");

    if (!nameInput.value || !emailInput.value || !passwordInput.value) {
      showToast("Please fill out all fields.", "error");
      return;
    }

    if (passwordInput.value.length < 6) {
      showToast("Password must be at least 6 characters long.", "error");
      return;
    }

    // Simulate Sign-up
    showToast("Account successfully created! Please sign in.", "success");

    // Reset form and transition back to sign-in page
    signUpForm.reset();
    setTimeout(() => {
      container.classList.remove("right-panel-active");
    }, 1200);
  });
}

// Setup Mobile-specific Switch triggers after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Add mobile links if they exist or create them dynamically
  const createMobileToggleLinks = () => {
    // Sign In Form Toggler
    const signInFormBody = signInForm;
    if (signInFormBody && !document.getElementById("mobileSignUpLink")) {
      const mobileLink = document.createElement("p");
      mobileLink.id = "mobileSignUpLink";
      mobileLink.className = "mobile-switch-link";
      mobileLink.textContent = `Don't have an account? Sign Up`;
      mobileLink.style =
        "margin-top: 20px; text-align: center; color: #007BFF; cursor: pointer;";

      mobileLink.addEventListener("click", () => {
        container.classList.add("right-panel-active");
      });
      signInFormBody.appendChild(mobileLink);
    }

    // Sign Up Form Toggler
    const signUpFormBody = signUpForm;
    if (signUpFormBody && !document.getElementById("mobileSignInLink")) {
      const mobileLink = document.createElement("p");
      mobileLink.id = "mobileSignInLink";
      mobileLink.className = "mobile-switch-link";
      mobileLink.textContent = `Already have an account? Sign In`;
      mobileLink.style =
        "margin-top: 20px; text-align: center; color: #007BFF; cursor: pointer;";
      mobileLink.addEventListener("click", () => {
        container.classList.remove("right-panel-active");
      });
      signUpFormBody.appendChild(mobileLink);
    }
  };

  createMobileToggleLinks();
});
