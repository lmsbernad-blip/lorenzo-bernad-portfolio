// ---------- Icons ----------
if (window.feather) {
  feather.replace({ "stroke-width": 1.8 });
}

// ---------- Skills marquee ----------
const skills = [
  "SQL", "Python", "Power BI", "Excel", "Microsoft Azure",
  "GitHub", "Audit Analytics", "Data Governance", "Stakeholder Management"
];

function buildMarquee(el){
  el.innerHTML = skills.map(s => `<span>${s}</span>`).join("");
}

const a = document.getElementById("marquee-a");
const b = document.getElementById("marquee-b");
if (a && b){
  buildMarquee(a);
  buildMarquee(b);
}

// ---------- Active sidebar link on scroll ----------
const navLinks = document.querySelectorAll(".side-nav a");
const sections = Array.from(navLinks).map(link =>
  document.querySelector(link.getAttribute("href"))
).filter(Boolean);

function setActiveLink(){
  let currentId = sections[0] && sections[0].id;
  const scrollPos = window.scrollY + window.innerHeight * 0.3;

  sections.forEach(section => {
    if (section.offsetTop <= scrollPos) currentId = section.id;
  });

  navLinks.forEach(link => {
    link.classList.toggle("nav-active", link.getAttribute("href") === `#${currentId}`);
  });
}

window.addEventListener("scroll", setActiveLink, { passive: true });
window.addEventListener("load", setActiveLink);

// ---------- Footer year ----------
const now = new Date().getFullYear();
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = now;
const yearEl2 = document.getElementById("year2");
if (yearEl2) yearEl2.textContent = now;
