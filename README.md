# Grocery Compare

## Overview
Grocery Compare is a simple web app that helps users find the best price for grocery items across multiple stores (Walmart, Kroger, HEB, Sam’s, etc.).

Instead of manually checking each store’s app, users can search once and quickly compare prices in one place.

## Core Idea
User flow:
1. Enter a grocery item (ex: "93/7 ground beef")
2. Select stores to compare
3. App retrieves price data (API or scraping)
4. Prices are displayed side-by-side
5. Best deal is highlighted

## Problem
Comparing grocery prices currently requires:
- checking multiple apps
- repeating the same searches
- manually comparing prices

This process is slow and inconvenient.

## Solution
A centralized tool that:
- searches once
- compares multiple stores
- quickly shows the cheapest option

## MVP (Version 1 Features)
- search bar for grocery items
- store selection options
- price comparison display
- highlight lowest price
- mobile-friendly design
- web-based (no download required)

Example:

| Store   | Price |
|--------|------|
| Walmart | $5.98 |
| Kroger  | $6.49 |
| HEB     | $6.19 |

Best Deal: Walmart

## Tech Stack
Frontend:
- HTML
- CSS
- JavaScript

Backend (later):
- Node.js or Python
- API integration or web scraping

## Future Features
- shopping list
- saved items
- price history
- deal alerts
- barcode search
- more stores

## Goal
Build a practical tool that saves time and helps users find better grocery deals while improving my web development skills.