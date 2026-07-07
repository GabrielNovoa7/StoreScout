// Grabbing the HTML sections and connecting them to javascript
const searchButton = document.getElementById("searchButton"); //search button
const itemInput = document.getElementById("itemInput"); //search bar
const resultsDiv = document.getElementById("results"); //results area

// temp data for testing
const groceryPrices = [
    { item: "eggs", store: "Walmart", price: 5.98, unit: "dozen" },
    { item: "eggs", store: "Kroger", price: 6.49, unit: "dozen" },
    { item: "eggs", store: "HEB", price: 6.19, unit: "dozen" },
    { item: "eggs", store: "SamsClub", price: 5.50, unit: "dozen" },
    { item: "eggs", store: "Costco", price: 5.25, unit: "dozen" },

    { item: "ground beef", store: "Walmart", price: 4.98, unit: "lb" },
    { item: "ground beef", store: "Kroger", price: 5.49, unit: "lb" },
    { item: "ground beef", store: "HEB", price: 4.77, unit: "lb" },
    { item: "ground beef", store: "SamsClub", price: 4.33, unit: "lb" },
    { item: "ground beef", store: "Costco", price: 4.20, unit: "lb" },

    { item: "milk", store: "Walmart", price: 3.12, unit: "gallon" },
    { item: "milk", store: "Kroger", price: 3.49, unit: "gallon" },
    { item: "milk", store: "HEB", price: 3.28, unit: "gallon" }
];

searchButton.addEventListener("click", searchItem); //runs the searchItem function when the button is clicked

itemInput.addEventListener("keydown", function(event)
{
    if(event.key === "Enter") //lets the enter button work too insead of clicking search
    {
        searchItem();
    }
}); 

function searchItem() 
{
    const searchText = itemInput.value.trim().toLowerCase();

    if (searchText === "") 
    {
        resultsDiv.innerHTML = `<p>Please enter an item to search.</p>`;
        return;
    } //Error handeling for when the text box is empty

    const selectedStores = Array.from(document.querySelectorAll(".storeSelection input:checked")).map(checkbox => checkbox.value); //displays results from the checkbox that is clicked

    const matches = groceryPrices.filter(product => {return product.item.toLowerCase().includes(searchText) && selectedStores.includes(product.store);});

    if (matches.length === 0) 
    {
        resultsDiv.innerHTML = `<p>No prices found for "${searchText}".</p>`;
        return;
    }

    matches.sort((a, b) => a.price - b.price);

    const cheapestPrice = matches[0].price;

    resultsDiv.innerHTML = `
        <h3>Results for: ${searchText}</h3>
        ${matches.map(product => `
            <div class="result-card ${product.price === cheapestPrice ? "best" : ""}">
                <div>
                    <strong>${formatStoreName(product.store)}</strong>
                    <p>$${product.price.toFixed(2)} / ${product.unit}</p>
                </div>

                ${product.price === cheapestPrice ? `<span class="badge">Best Deal</span>` : ""}
            </div>
        `).join("")}
    `;
}

function formatStoreName(store) 
{
    if (store === "SamsClub") 
    {
        return "Sam's Club";
    }

    return store;
}