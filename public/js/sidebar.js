document.addEventListener("DOMContentLoaded", function () {
    const themeLink=document.createElement("link");themeLink.rel="stylesheet";themeLink.href="/css/theme.css";document.head.appendChild(themeLink);
    const themeToggle=document.getElementById("themeToggle"),themeIcon=document.getElementById("themeIcon"),savedTheme=localStorage.getItem("hrNovaTheme")||"light";
    document.body.classList.toggle("dark-mode",savedTheme==="dark");if(themeIcon)themeIcon.className=savedTheme==="dark"?"bi bi-sun":"bi bi-moon";
    if(themeToggle)themeToggle.addEventListener("click",function(){const dark=document.body.classList.toggle("dark-mode");localStorage.setItem("hrNovaTheme",dark?"dark":"light");if(themeIcon)themeIcon.className=dark?"bi bi-sun":"bi bi-moon";});
    const sidebar = document.getElementById("sidebar");
    const menuButton = document.getElementById("menuButton");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    if (!sidebar || !menuButton || !sidebarOverlay) {
        return;
    }

    function openSidebar() {
        sidebar.classList.add("open");
        sidebarOverlay.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("show");
        document.body.style.overflow = "";
    }

    menuButton.addEventListener("click", function () {
        if (sidebar.classList.contains("open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    sidebarOverlay.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeSidebar();
        }
    });

    window.addEventListener("resize", function () {
        if (window.innerWidth > 991) {
            closeSidebar();
        }
    });
});
