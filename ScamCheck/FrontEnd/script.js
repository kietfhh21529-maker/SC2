const samples = {
  bank: "[VietBank] Tài khoản của quý khách đang bị khóa do giao dịch bất thường. Vui lòng bấm vào link http://vietbank-xacminh.top và nhập OTP để mở lại tài khoản trong 10 phút.",
  police:
    "Tôi là cán bộ công an. Anh/chị đang liên quan đến đường dây rửa tiền. Chuyển ngay 20 triệu vào tài khoản này để phục vụ điều tra, nếu không sẽ bị bắt giam.",
  prize:
    "Chúc mừng bạn đã trúng thưởng xe SH và 100 triệu đồng. Hãy gửi phí hồ sơ 500.000đ và CCCD để nhận thưởng ngay hôm nay.",
};

let historyData = JSON.parse(localStorage.getItem("scamcheck_history")) || [];

function saveHistory() {
  localStorage.setItem("scamcheck_history", JSON.stringify(historyData));
}

const screens = {
  home: document.getElementById("homeScreen"),
  loading: document.getElementById("loadingScreen"),
  result: document.getElementById("resultScreen"),
  history: document.getElementById("historyScreen"),
};

const messageInput = document.getElementById("messageInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const openHistoryBtn = document.getElementById("openHistoryBtn");
const closeHistoryBtn = document.getElementById("closeHistoryBtn");
const backHomeBtn = document.getElementById("backHomeBtn");

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showFriendlyError(message) {
  alert(message);
  showScreen("home");
}

function classifyMessage(text) {
  const lower = text.toLowerCase();
  let score = 0;

  if (
    lower.includes("otp") ||
    lower.includes("mật khẩu") ||
    lower.includes("ngân hàng")
  )
    score += 3;

  if (
    lower.includes("chuyển") ||
    lower.includes("tiền") ||
    lower.includes("phí")
  )
    score += 2;

  if (
    lower.includes("công an") ||
    lower.includes("điều tra") ||
    lower.includes("bắt")
  )
    score += 3;

  if (
    lower.includes("link") ||
    lower.includes("http") ||
    lower.includes("bấm vào")
  )
    score += 2;

  if (
    lower.includes("gấp") ||
    lower.includes("ngay") ||
    lower.includes("10 phút") ||
    lower.includes("khóa")
  )
    score += 2;

  if (lower.includes("trúng thưởng") || lower.includes("cccd")) score += 2;

  if (score >= 7) return "Nghiêm trọng";
  if (score >= 5) return "Cao";
  if (score >= 2) return "Trung bình";
  return "Thấp";
}

function levelClass(level) {
  return (
    {
      Thấp: "low",
      "Trung bình": "medium",
      Cao: "high",
      "Nghiêm trọng": "severe",
    }[level] || "medium"
  );
}

function riskDisplay(level) {
  if (level === "Thấp") {
    return {
      label: "An toàn",
      percent: "18%",
    };
  }

  if (level === "Trung bình") {
    return {
      label: "Nghi ngờ",
      percent: "55%",
    };
  }

  return {
    label: "Nguy hiểm",
    percent: level === "Cao" ? "82%" : "100%",
  };
}

function renderResult(text, aiResult = null, shouldSaveHistory = true) {
  const level = aiResult?.level || classifyMessage(text);
  const type = levelClass(level);
  const displayRisk = riskDisplay(level);
  const shouldShowWarningDetails = level !== "Thấp";

  const riskCard = document.getElementById("riskCard");
  const riskTitle = document.getElementById("riskTitle");
  const riskDescription = document.getElementById("riskDescription");
  const riskBadge = document.getElementById("riskBadge");
  const riskMeterFill = document.getElementById("riskMeterFill");

  riskCard.className = `main-card risk-card risk-${type}`;
  riskTitle.textContent = displayRisk.label;
  riskBadge.textContent = displayRisk.label;

  if (riskMeterFill) {
    riskMeterFill.style.width = displayRisk.percent;
  }

  const descriptions = {
    Thấp: "Tin nhắn chưa có dấu hiệu nguy hiểm rõ ràng, nhưng vẫn nên kiểm tra nguồn gửi.",
    "Trung bình":
      "Tin nhắn có một số điểm đáng ngờ, cần xác minh trước khi làm theo.",
    Cao: "Tin nhắn có nhiều dấu hiệu lừa đảo và có thể gây mất tiền hoặc lộ thông tin.",
    "Nghiêm trọng":
      "Tin nhắn có dấu hiệu lừa đảo rất rõ, tuyệt đối không làm theo yêu cầu.",
  };

  riskDescription.textContent = aiResult?.description || descriptions[level];

  const signCard = document.getElementById("signCard");
  const suspiciousCard = document.getElementById("suspiciousCard");
  const counselorCard = document.querySelector(".counselor-card");

  if (signCard) {
    signCard.style.display = shouldShowWarningDetails ? "block" : "none";
  }

  if (suspiciousCard) {
    suspiciousCard.style.display = shouldShowWarningDetails ? "block" : "none";
  }

  if (counselorCard) {
    counselorCard.style.display = shouldShowWarningDetails ? "flex" : "none";
  }

  if (shouldShowWarningDetails) {
    const signs = aiResult?.signs || [
      "Có yếu tố thúc giục hoặc gây áp lực thời gian.",
      "Có thể yêu cầu thông tin nhạy cảm như OTP, CCCD, tài khoản ngân hàng.",
      "Nội dung có dấu hiệu giả danh tổ chức hoặc cơ quan chức năng.",
    ];

    document.getElementById("signList").innerHTML = signs
      .map((item) => `<li>${item}</li>`)
      .join("");

    const quote =
      aiResult?.suspicious_quote ||
      text.slice(0, 180) + (text.length > 180 ? "..." : "");

    document.getElementById("suspiciousQuote").textContent = quote;

    document.getElementById("counselorText").textContent =
      aiResult?.counselor ||
      "Con hãy bình tĩnh, đừng bấm vào liên kết và cũng đừng chuyển tiền. Hãy hỏi người thân hoặc gọi tổng đài chính thức để kiểm tra lại nhé.";
  }

  const actions = shouldShowWarningDetails
    ? aiResult?.actions || [
        "Không bấm vào đường link lạ.",
        "Không chuyển tiền hoặc cung cấp OTP.",
        "Gọi số chính thức của ngân hàng/cơ quan để xác minh.",
      ]
    : [
        "Kiểm tra xem người gửi là ai, bạn có quen biết họ không.",
        "Chưa cần làm gì đặc biệt, nhưng nếu là số lạ, hãy cẩn trọng với các tin nhắn tiếp theo.",
        "Tuyệt đối không nhập vào đường link hay cung cấp thông tin cá nhân nếu có yêu cầu trong tương lai.",
      ];

  document.getElementById("actionList").innerHTML = actions
    .map(
      (item, index) =>
        `<div class="action-item"><strong>${index + 1}.</strong> ${item}</div>`,
    )
    .join("");

  if (shouldSaveHistory) {
    historyData.unshift({
      time: new Date().toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      }),
      level,
      short: text.slice(0, 58) + (text.length > 58 ? "..." : ""),
      sample: text,
      aiResult,
    });

    historyData = historyData.slice(0, 10);
    saveHistory();
  }
}

function renderHistory() {
  const historyList = document.getElementById("historyList");

  if (historyData.length === 0) {
    historyList.innerHTML = `
      <div class="empty-history">
        Chưa có lịch sử phân tích. Hãy nhập một tin nhắn và bấm Phân tích nhé.
      </div>
    `;
    return;
  }

  historyList.innerHTML = historyData
    .map((item, index) => {
      const type = levelClass(item.level);
      return `
      <article class="history-item">
        <strong>${item.time}</strong>
        <span class="level-pill level-${type}">${item.level}</span>
        <span>${item.short}</span>
        <button class="view-btn" data-index="${index}">Xem lại</button>
      </article>
    `;
    })
    .join("");

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = historyData[Number(btn.dataset.index)];
      renderResult(item.sample, item.aiResult || null, false);
      showScreen("result");
    });
  });
}

document.querySelectorAll(".sample-buttons button").forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value = samples[button.dataset.sample];
    messageInput.focus();
  });
});

async function analyzeWithAI(text) {
  const API_URL = "https://scamcheck-2-07zf.onrender.com";

  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "AI trả về dữ liệu không đúng cấu trúc. Bạn hãy thử lại nhé.",
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error || "Không thể gọi AI lúc này. Bạn hãy thử lại sau nhé.",
      );
    }

    const requiredFields = [
      "level",
      "description",
      "signs",
      "suspicious_quote",
      "actions",
      "counselor",
    ];

    const validLevels = ["Thấp", "Trung bình", "Cao", "Nghiêm trọng"];

    const isValid =
      data &&
      typeof data === "object" &&
      requiredFields.every((field) => field in data) &&
      validLevels.includes(data.level) &&
      Array.isArray(data.signs) &&
      Array.isArray(data.actions);

    if (!isValid) {
      throw new Error(
        "AI trả về dữ liệu chưa đúng cấu trúc. Ứng dụng vẫn hoạt động, bạn hãy thử lại nhé.",
      );
    }

    return data;
  } catch (error) {
    if (!navigator.onLine) {
      throw new Error(
        "Bạn đang mất kết nối mạng. Hãy kiểm tra Wi-Fi/Internet rồi thử lại nhé.",
      );
    }

    throw error;
  }
}

analyzeBtn.addEventListener("click", async () => {
  const text = messageInput.value.trim();

  if (!text) {
    showFriendlyError(
      "Bạn chưa nhập tin nhắn. Hãy dán một tin nhắn cần kiểm tra nhé.",
    );
    return;
  }

  if (text.length > 5000) {
    showFriendlyError(
      "Tin nhắn quá dài. Bạn hãy rút gọn dưới 5000 ký tự rồi thử lại nhé.",
    );
    return;
  }

  showScreen("loading");

  try {
    const aiResult = await analyzeWithAI(text);
    renderResult(text, aiResult, true);
    showScreen("result");
  } catch (error) {
    console.warn(error);
    alert(
      error.message ||
        "Ứng dụng gặp lỗi nhưng vẫn hoạt động. Bạn hãy thử lại nhé.",
    );
    renderResult(text, null, true);
    showScreen("result");
  }
});

openHistoryBtn.addEventListener("click", () => {
  renderHistory();
  showScreen("history");
});

closeHistoryBtn.addEventListener("click", () => showScreen("home"));
backHomeBtn.addEventListener("click", () => showScreen("home"));
