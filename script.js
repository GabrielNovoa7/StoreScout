const searchButton = document.getElementById("searchButton");
searchButton.addEventListener("click", function() {
    const item =document.getElementById("itemInput").value;
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = `
    <h3>Results for: ${item}</h3>

    <div class="result-card">
        Walmart: $5.98
    </div>

    <div class="result-card">
        Kroger: $6.49
    </div>

    <div class="result-card">
        HEB: $6.19
    </div>

    <div class="result-card">
        HEB: $6.19
    </div>

    <div class="result-card">
        Sam's Club: $6.18
    </div>

    <div class="result-card">
        Costco: $6.80
    </div>
    `;
});