package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type Product struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Stock       int     `json:"stock"`
	Image       string  `json:"image"`
}

var products = []Product{
	{
		ID:          1,
		Name:        "iPhone 17 Pro Max",
		Description: "6.9\" Super Retina XDR · A19 Pro · 5x Tetraprism · Titanium",
		Price:       1199.99,
		Stock:       100,
		Image:       "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=600&q=80",
	},
	{
		ID:          2,
		Name:        "MacBook Pro 16 M5",
		Description: "16\" Liquid Retina XDR · M5 Pro · 24GB RAM · 512GB SSD",
		Price:       2499.99,
		Stock:       50,
		Image:       "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80",
	},
	{
		ID:          3,
		Name:        "AirPods Pro 2",
		Description: "Active Noise Cancellation · Adaptive Audio · H2 chip · USB-C",
		Price:       249.99,
		Stock:       200,
		Image:       "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&q=80",
	},
}

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "product-service",
		"db":      "in-memory",
	})
}

func (h *Handler) GetProducts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}

func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	id := parts[len(parts)-1]

	w.Header().Set("Content-Type", "application/json")
	for _, p := range products {
		if fmt.Sprintf("%d", p.ID) == id {
			json.NewEncoder(w).Encode(p)
			return
		}
	}
	w.WriteHeader(http.StatusNotFound)
	json.NewEncoder(w).Encode(map[string]string{"error": "Product not found"})
}
