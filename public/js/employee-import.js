document.addEventListener(
    "DOMContentLoaded",
    function () {
        const importForm =
            document.getElementById(
                "employeeImportForm"
            );

        const fileInput =
            document.getElementById(
                "employeeExcelFile"
            );

        const uploadArea =
            document.getElementById(
                "uploadArea"
            );

        const selectedFileCard =
            document.getElementById(
                "selectedFileCard"
            );

        const selectedFileName =
            document.getElementById(
                "selectedFileName"
            );

        const selectedFileSize =
            document.getElementById(
                "selectedFileSize"
            );

        const removeFileButton =
            document.getElementById(
                "removeFileButton"
            );

        const previewButton =
            document.getElementById(
                "previewButton"
            );

        const importError =
            document.getElementById(
                "importError"
            );

        if (
            !importForm ||
            !fileInput ||
            !uploadArea ||
            !selectedFileCard ||
            !selectedFileName ||
            !selectedFileSize ||
            !removeFileButton ||
            !previewButton ||
            !importError
        ) {
            console.error(
                "Excel aktarım arayüzündeki bazı alanlar bulunamadı."
            );

            return;
        }

        const allowedExtensions = [
            "xlsx",
            "xls"
        ];

        const maximumFileSize =
            10 * 1024 * 1024;

        function formatFileSize(bytes) {
            if (bytes < 1024) {
                return `${bytes} B`;
            }

            const kilobytes =
                bytes / 1024;

            if (kilobytes < 1024) {
                return `${kilobytes.toFixed(
                    1
                )} KB`;
            }

            return `${(
                kilobytes / 1024
            ).toFixed(2)} MB`;
        }

        function showError(message) {
            importError.textContent =
                message;

            importError.classList.add(
                "show"
            );

            importError.style.display =
                "block";
        }

        function hideError() {
            importError.textContent = "";

            importError.classList.remove(
                "show"
            );

            importError.style.display =
                "none";
        }

        function resetSelectedFile() {
            fileInput.value = "";

            selectedFileCard.classList.remove(
                "show"
            );

            selectedFileCard.style.display =
                "none";

            uploadArea.classList.remove(
                "has-file"
            );

            previewButton.disabled = true;

            selectedFileName.textContent =
                "Dosya seçilmedi";

            selectedFileSize.textContent =
                "-";

            hideError();
        }

        function validateFile(file) {
            if (!file) {
                resetSelectedFile();
                return false;
            }

            const extension =
                file.name
                    .split(".")
                    .pop()
                    .toLowerCase();

            if (
                !allowedExtensions.includes(
                    extension
                )
            ) {
                resetSelectedFile();

                showError(
                    "Lütfen yalnızca .xlsx veya .xls uzantılı bir dosya seçin."
                );

                return false;
            }

            if (
                file.size > maximumFileSize
            ) {
                resetSelectedFile();

                showError(
                    "Dosya boyutu 10 MB sınırını aşamaz."
                );

                return false;
            }

            hideError();

            selectedFileName.textContent =
                file.name;

            selectedFileSize.textContent =
                formatFileSize(file.size);

            selectedFileCard.classList.add(
                "show"
            );

            selectedFileCard.style.display =
                "flex";

            uploadArea.classList.add(
                "has-file"
            );

            previewButton.disabled = false;

            return true;
        }

        fileInput.addEventListener(
            "change",
            function () {
                validateFile(
                    this.files[0]
                );
            }
        );

        uploadArea.addEventListener(
            "click",
            function (event) {
                /*
                 Inputun kendisine tıklanmışsa
                 tekrar click çağırmıyoruz.
                */

                if (
                    event.target === fileInput
                ) {
                    return;
                }

                /*
                 Silme butonuna tıklanınca
                 dosya penceresi açılmasın.
                */

                if (
                    event.target.closest(
                        "#removeFileButton"
                    )
                ) {
                    return;
                }

                fileInput.click();
            }
        );

        uploadArea.addEventListener(
            "keydown",
            function (event) {
                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    event.preventDefault();
                    fileInput.click();
                }
            }
        );

        removeFileButton.addEventListener(
            "click",
            function (event) {
                event.preventDefault();
                event.stopPropagation();

                resetSelectedFile();
            }
        );

        [
            "dragenter",
            "dragover"
        ].forEach(function (eventName) {
            uploadArea.addEventListener(
                eventName,
                function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    uploadArea.classList.add(
                        "dragging"
                    );
                }
            );
        });

        [
            "dragleave",
            "drop"
        ].forEach(function (eventName) {
            uploadArea.addEventListener(
                eventName,
                function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    uploadArea.classList.remove(
                        "dragging"
                    );
                }
            );
        });

        uploadArea.addEventListener(
            "drop",
            function (event) {
                const droppedFile =
                    event.dataTransfer.files[0];

                if (
                    !validateFile(droppedFile)
                ) {
                    return;
                }

                const dataTransfer =
                    new DataTransfer();

                dataTransfer.items.add(
                    droppedFile
                );

                fileInput.files =
                    dataTransfer.files;
            }
        );

        importForm.addEventListener(
            "submit",
            function (event) {
                if (
                    !fileInput.files.length
                ) {
                    event.preventDefault();

                    showError(
                        "Önizlemeye geçmek için bir Excel dosyası seçmelisiniz."
                    );

                    return;
                }

                const selectedFile =
                    fileInput.files[0];

                if (
                    !validateFile(
                        selectedFile
                    )
                ) {
                    event.preventDefault();
                    return;
                }

                hideError();

                previewButton.disabled =
                    true;

                previewButton.innerHTML = `
                    <span
                        class="spinner-border spinner-border-sm"
                        aria-hidden="true"
                    ></span>

                    Excel okunuyor...
                `;
            }
        );
    }
);