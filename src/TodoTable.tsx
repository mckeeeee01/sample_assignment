import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

export default function TodoTable() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [content, setContent] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    const sub = client.models.Todo.observeQuery().subscribe({
      next: (snapshot) => setTodos([...snapshot.items]),
    });
    return () => sub.unsubscribe();
  }, []);

  async function addTodo() {
    if (!content) return;
    const iso = deadline ? new Date(deadline).toISOString() : undefined;
    const optimistic = {
      id: `tmp-${Date.now()}`,
      content,
      deadline: iso,
    } as Schema["Todo"]["type"];
    setTodos((curr) => [...curr, optimistic]);
    try {
      const { data } = await client.models.Todo.create({ content, deadline: iso });
      if (data) {
        setTodos((curr) => curr.map((t) => (t.id === optimistic.id ? data : t)));
      }
    } finally {
      setContent("");
      setDeadline("");
    }
  }

  async function deleteTodo(todo: Schema["Todo"]["type"]) {
    setTodos((curr) => curr.filter((t) => t.id !== todo.id));
    try {
      await client.models.Todo.delete({ id: todo.id });
    } catch {
      setTodos((curr) => [...curr, todo]);
    }
  }

  async function changeDeadline(todo: Schema["Todo"]["type"]) {
    const input = window.prompt("New deadline (YYYY-MM-DD)", todo.deadline?.slice(0, 10) || "");
    if (input === null) return;
    const iso = input ? new Date(input).toISOString() : undefined;
    const original = { ...todo };
    setTodos((curr) => curr.map((t) => (t.id === todo.id ? { ...t, deadline: iso } : t)));
    try {
      await client.models.Todo.update({ id: todo.id, deadline: iso });
    } catch {
      setTodos((curr) => curr.map((t) => (t.id === todo.id ? original : t)));
    }
  }


  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addTodo();
        }}
      >
        <input
          placeholder="task"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Deadline</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {todos.map((todo) => (
            <tr key={todo.id}>
              <td>{todo.content}</td>
              <td>
                {todo.deadline ? new Date(todo.deadline).toLocaleDateString() : ""}
              </td>
              <td>
                <button onClick={() => deleteTodo(todo)}>Delete</button>
              </td>
              <td>
                <button onClick={() => changeDeadline(todo)}>Change</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
