export interface Recipe {
  id: string;
  title: string;
  image: string;
  cost: string;
  saves: number;
  author: string;
}

export const RECIPES: Recipe[] = [
  {
    id: "1",
    title: "Avocado & Poached Egg Toast",
    image: "/assets/food-1.png",
    cost: "$4.50",
    saves: 1240,
    author: "Sophie Eats",
  },
  {
    id: "2",
    title: "Berry Acai Power Bowl",
    image: "/assets/food-2.png",
    cost: "$6.20",
    saves: 890,
    author: "Healthy Mike",
  },
  {
    id: "3",
    title: "Pesto Pasta with Pine Nuts",
    image: "/assets/food-3.png",
    cost: "$3.80",
    saves: 2100,
    author: "Budget Chef",
  },
  {
    id: "4",
    title: "Grilled Salmon Asparagus",
    image: "/assets/food-4.png",
    cost: "$8.50",
    saves: 1500,
    author: "Gourmet Home",
  },
  {
    id: "5",
    title: "Avocado & Poached Egg Toast",
    image: "/assets/food-1.png",
    cost: "$4.50",
    saves: 1240,
    author: "Sophie Eats",
  },
  {
    id: "6",
    title: "Berry Acai Power Bowl",
    image: "/assets/food-2.png",
    cost: "$6.20",
    saves: 890,
    author: "Healthy Mike",
  },
];

export const PRICES = [
  { store: "Woolworths", item: "Avocado", price: 2.50 },
  { store: "Coles", item: "Avocado", price: 2.80 },
  { store: "Aldi", item: "Avocado", price: 1.90, cheapest: true },
  { store: "Harris Farm", item: "Avocado", price: 3.20 },
];

export const MEAL_PLAN = [
  { day: "Mon", meal: "Pesto Pasta", calories: 450 },
  { day: "Tue", meal: "Salmon Salad", calories: 380 },
  { day: "Wed", meal: "Chicken Stir Fry", calories: 520 },
  { day: "Thu", meal: "Lentil Soup", calories: 320 },
  { day: "Fri", meal: "Tacos", calories: 600 },
  { day: "Sat", meal: "Pizza Night", calories: 800 },
  { day: "Sun", meal: "Roast Chicken", calories: 650 },
];
