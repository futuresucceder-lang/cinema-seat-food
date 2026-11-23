"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type FoodItem = {
  id: string;
  cinema_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  is_available: boolean;
  created_at: string;
};

export default function FoodMenuPage() {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Snacks");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] =
    useState<string | null>(null);

  // --------------------------------------------------
  // Get logged-in Manager's cinema ID
  // --------------------------------------------------

  async function getManagerCinemaId() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        "Could not get the logged-in Manager account."
      );
    }

    const role =
      user.app_metadata?.role;

    const cinemaId =
      user.app_metadata?.cinema_id;

    if (role !== "manager") {
      throw new Error(
        "Only Manager accounts can manage food items."
      );
    }

    if (!cinemaId) {
      throw new Error(
        "This Manager account is not assigned to a cinema."
      );
    }

    return cinemaId as string;
  }

  // --------------------------------------------------
  // Load only this cinema's food items
  // --------------------------------------------------

  async function loadFoodItems() {
    setLoading(true);

    try {
      const cinemaId = await getManagerCinemaId();

      const { data, error } = await supabase
        .from("food_items")
        .select("*")
        .eq("cinema_id", cinemaId)
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Error loading food items:",
          error
        );

        alert(
          "Could not load food items: " +
            error.message
        );

        setFoodItems([]);
        setLoading(false);
        return;
      }

      setFoodItems((data || []) as FoodItem[]);
    } catch (error) {
      console.error(
        "Food menu loading error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error";

      alert("Could not load food menu: " + message);

      setFoodItems([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadFoodItems();
  }, []);

  // --------------------------------------------------
  // Reset form
  // --------------------------------------------------

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("");
    setCategory("Snacks");
    setIsAvailable(true);
    setImageFile(null);
    setCurrentImageUrl(null);
  }

  // --------------------------------------------------
  // Start editing
  // --------------------------------------------------

  function startEdit(item: FoodItem) {
    setEditingId(item.id);
    setName(item.name);
    setDescription(item.description || "");
    setPrice(String(item.price));
    setCategory(item.category);
    setIsAvailable(item.is_available);
    setImageFile(null);
    setCurrentImageUrl(item.image_url);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // --------------------------------------------------
  // Upload food image
  // --------------------------------------------------

  async function uploadImage(file: File) {
    const extension =
      file.name.split(".").pop() || "jpg";

    const filePath = `food/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from("food-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage
      .from("food-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  // --------------------------------------------------
  // Get storage path from image URL
  // --------------------------------------------------

  function getStoragePath(imageUrl: string | null) {
    if (!imageUrl) return null;

    const marker =
      "/storage/v1/object/public/food-images/";

    const index = imageUrl.indexOf(marker);

    if (index === -1) return null;

    return decodeURIComponent(
      imageUrl.substring(
        index + marker.length
      )
    );
  }

  // --------------------------------------------------
  // Delete image
  // --------------------------------------------------

  async function deleteImage(
    imageUrl: string | null
  ) {
    const path = getStoragePath(imageUrl);

    if (!path) return;

    const { error } = await supabase.storage
      .from("food-images")
      .remove([path]);

    if (error) {
      console.error(
        "Could not delete image:",
        error
      );
    }
  }

  // --------------------------------------------------
  // Add / Update food item
  // --------------------------------------------------

  async function saveFoodItem(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter a food name.");
      return;
    }

    if (!price || Number(price) <= 0) {
      alert("Please enter a valid price.");
      return;
    }

    setSaving(true);

    try {
      // Get the cinema from the logged-in Manager
      const cinemaId =
        await getManagerCinemaId();

      let imageUrl = currentImageUrl;

      // Upload new image if selected
      if (imageFile) {
        imageUrl =
          await uploadImage(imageFile);
      }

      // --------------------------------------------------
      // UPDATE EXISTING FOOD ITEM
      // --------------------------------------------------

      if (editingId) {
        const { error } = await supabase
          .from("food_items")
          .update({
            name: name.trim(),
            description:
              description.trim() || null,
            price: Number(price),
            category,
            image_url: imageUrl,
            is_available: isAvailable,
          })
          .eq("id", editingId)
          .eq("cinema_id", cinemaId);

        if (error) {
          throw error;
        }

        // Remove old image after successful replacement
        if (
          imageFile &&
          currentImageUrl &&
          currentImageUrl !== imageUrl
        ) {
          await deleteImage(
            currentImageUrl
          );
        }

        alert(
          "Food item updated successfully."
        );
      }

      // --------------------------------------------------
      // ADD NEW FOOD ITEM
      // --------------------------------------------------

      else {
        const { error } = await supabase
          .from("food_items")
          .insert({
            cinema_id: cinemaId,
            name: name.trim(),
            description:
              description.trim() || null,
            price: Number(price),
            image_url: imageUrl,
            category,
            is_available: isAvailable,
          });

        if (error) {
          throw error;
        }

        alert(
          "Food item added successfully."
        );
      }

      resetForm();

      await loadFoodItems();
    } catch (error) {
      console.error(
        "Food item save error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error";

      alert(
        "Could not save food item: " +
          message
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // Delete food item
  // --------------------------------------------------

  async function deleteFoodItem(
    item: FoodItem
  ) {
    const confirmed = window.confirm(
      `Delete "${item.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const cinemaId =
        await getManagerCinemaId();

      const { error } = await supabase
        .from("food_items")
        .delete()
        .eq("id", item.id)
        .eq("cinema_id", cinemaId);

      if (error) {
        alert(
          "Could not delete food item: " +
            error.message
        );
        return;
      }

      await deleteImage(
        item.image_url
      );

      if (editingId === item.id) {
        resetForm();
      }

      await loadFoodItems();
    } catch (error) {
      console.error(
        "Delete food item error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error";

      alert(
        "Could not delete food item: " +
          message
      );
    }
  }

  // --------------------------------------------------
  // Toggle availability
  // --------------------------------------------------

  async function toggleAvailability(
    item: FoodItem
  ) {
    try {
      const cinemaId =
        await getManagerCinemaId();

      const { error } = await supabase
        .from("food_items")
        .update({
          is_available:
            !item.is_available,
        })
        .eq("id", item.id)
        .eq("cinema_id", cinemaId);

      if (error) {
        alert(
          "Could not change availability: " +
            error.message
        );
        return;
      }

      await loadFoodItems();
    } catch (error) {
      console.error(
        "Availability update error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error";

      alert(
        "Could not change availability: " +
          message
      );
    }
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <main className="seatbite-food-menu-page"
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: "30px 20px 60px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <Link
          href="/admin"
          style={{
            color: "#aaa",
            textDecoration: "none",
          }}
        >
          ← Back to Admin Dashboard
        </Link>

        <header
          style={{
            textAlign: "center",
            margin: "30px 0 40px",
          }}
        >
          <img
            src="/seatbite-logo.webp.jpg"
            alt="SeatBite"
            style={{
              width: "min(460px, 88vw)",
              height: "170px",
              objectFit: "contain",
              objectPosition: "center",
              display: "block",
              margin: "0 auto 12px",
              mixBlendMode: "darken",
            }}
          />

          <h1
            style={{
              fontSize: "36px",
              margin: "5px 0",
            }}
          >
            Food Menu Management
          </h1>

          <p style={{ color: "#aaa" }}>
            Add and manage your cinema food menu.
          </p>
        </header>

        {/* ADD / EDIT FORM */}

        <section
          className="seatbite-food-menu-form"
          style={{
            background: "#222",
            borderRadius: "18px",
            padding: "25px",
            marginBottom: "35px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            {editingId
              ? "✏️ Edit Food Item"
              : "➕ Add Food Item"}
          </h2>

          <form onSubmit={saveFoodItem}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <label>Food Name</label>

                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="Example: Chicken Burger"
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Price</label>

                <input
                  type="number"
                  min="1"
                  value={price}
                  onChange={(e) =>
                    setPrice(e.target.value)
                  }
                  placeholder="200"
                  style={inputStyle}
                />
              </div>

              <div>
                <label>Category</label>

                <div style={{ position: "relative", marginTop: "8px" }}>
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={categoryOpen}
                    onClick={() => setCategoryOpen((open) => !open)}
                    style={{
                      ...inputStyle,
                      marginTop: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      textAlign: "left",
                      color: "#000000",
                      background: "#fffdf8",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ color: "#000000" }}>{category}</span>
                    <span aria-hidden="true" style={{ color: "#000000" }}>⌄</span>
                  </button>
                  {categoryOpen && (
                    <div
                      role="listbox"
                      aria-label="Food category"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        background: "#ffffff",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        overflow: "hidden",
                        boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
                      }}
                    >
                      {["Snacks", "Meals", "Drinks"].map((option) => (
                        <button
                          key={option}
                          type="button"
                          role="option"
                          aria-selected={category === option}
                          onClick={() => {
                            setCategory(option);
                            setCategoryOpen(false);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px 14px",
                            border: "none",
                            background: category === option ? "#f3f4f6" : "#ffffff",
                            color: "#000000",
                            textAlign: "left",
                            fontSize: "15px",
                            cursor: "pointer",
                          }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label>Food Photo</label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setImageFile(
                      e.target.files?.[0] ||
                        null
                    )
                  }
                  style={{
                    display: "block",
                    marginTop: "8px",
                    color: "white",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: "18px",
              }}
            >
              <label>Description</label>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
                placeholder="Describe the food item..."
                rows={3}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
              />
            </div>

            {currentImageUrl && (
              <div
                style={{
                  marginTop: "18px",
                }}
              >
                <p
                  style={{
                    color: "#aaa",
                  }}
                >
                  Current photo:
                </p>

                <img
                  src={currentImageUrl}
                  alt="Current food"
                  style={{
                    width: "180px",
                    height: "120px",
                    objectFit: "cover",
                    borderRadius: "10px",
                  }}
                />
              </div>
            )}

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) =>
                  setIsAvailable(
                    e.target.checked
                  )
                }
              />

              Available to customers
            </label>

            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "25px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "12px 22px",
                  border: "none",
                  borderRadius: "10px",
                  background: "white",
                  color: "#111",
                  fontWeight: "bold",
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "💾 Update Food Item"
                  : "➕ Add Food Item"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    padding: "12px 22px",
                    border: "none",
                    borderRadius: "10px",
                    background: "#444",
                    color: "white",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        {/* FOOD ITEMS */}

        <section>
          <div className="seatbite-food-items-heading">
            <span className="seatbite-food-items-heading-icon">🍿</span>
            <div>
              <h2>Current Food Items</h2>
              <p>View, update and manage the food available in your cinema.</p>
            </div>
            <span className="seatbite-food-items-count">{foodItems.length} ITEMS</span>
          </div>

          {loading ? (
            <p style={{ color: "#aaa" }}>
              Loading food items...
            </p>
          ) : foodItems.length === 0 ? (
            <p style={{ color: "#aaa" }}>
              No food items found.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "20px",
              }}
            >
              {foodItems.map((item) => (
                <div
                  key={item.id}
                  className="seatbite-food-item-card"
                  style={{
                    background: "#222",
                    borderRadius: "15px",
                    overflow: "hidden",
                  }}
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{
                        width: "100%",
                        height: "190px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: "190px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#333",
                        fontSize: "65px",
                      }}
                    >
                      🍔
                    </div>
                  )}

                  <div
                    style={{
                      padding: "18px",
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 8px",
                        fontSize: "21px",
                      }}
                    >
                      {item.name}
                    </h3>

                    <p
                      style={{
                        color: "#aaa",
                        minHeight: "42px",
                      }}
                    >
                      {item.description ||
                        "No description"}
                    </p>

                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      ₹{item.price}
                    </div>

                    <div
                      style={{
                        color: "#bbb",
                        marginBottom: "12px",
                      }}
                    >
                      {item.category}
                    </div>

                    <span
                      style={{
                        display: "inline-block",
                        padding: "6px 10px",
                        borderRadius: "20px",
                        background:
                          item.is_available
                            ? "#164b2a"
                            : "#4b1616",
                        color:
                          item.is_available
                            ? "#7cff9b"
                            : "#ff8585",
                        fontSize: "13px",
                        fontWeight: "bold",
                        marginBottom: "15px",
                      }}
                    >
                      {item.is_available
                        ? "Available"
                        : "Unavailable"}
                    </span>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={() =>
                          startEdit(item)
                        }
                        style={
                          actionButtonStyle
                        }
                      >
                        ✏️ Edit
                      </button>

                      <button
                        onClick={() =>
                          toggleAvailability(
                            item
                          )
                        }
                        style={
                          actionButtonStyle
                        }
                      >
                        {item.is_available
                          ? "🔴 Disable"
                          : "🟢 Enable"}
                      </button>

                      <button
                        onClick={() =>
                          deleteFoodItem(item)
                        }
                        style={{
                          ...actionButtonStyle,
                          background:
                            "#5a1b1b",
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: "8px",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #555",
  background: "#333",
  color: "white",
  fontSize: "15px",
};

const actionButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: "none",
  borderRadius: "8px",
  background: "#444",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};