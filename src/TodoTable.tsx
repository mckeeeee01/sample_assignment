import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

export default function TodoTable() {
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [content, setContent] = useState("");
  const [subTasks, setSubTasks] = useState<Array<Schema["subtask"]["type"]>>([]);
  const [subTaskInput, setSubTaskInput] = useState<Record<string, string>>({});
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


  
  async function addSubTask(todoId: string) {
    const title = subTaskInput[todoId];
    if (!title) return;
    const optimistic = {
      id: `tmp-${Date.now()}`,
      content: title,
      todoId: todoId,
    };
    setSubTasks((curr) => [...curr, optimistic as unknown as Schema["subtask"]["type"]]);
    try {
      const { data } = await client.models.subtask.create({ content: title, todoId: todoId });
      if (data) {
        setSubTasks((curr) => curr.map((s) => (s.id === optimistic.id ? data : s)));
      }
    } finally {
      setSubTaskInput((curr) => ({ ...curr, [todoId]: "" }));
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

   async function toggleSubTask(subTask: Schema["subtask"]["type"]) {
    const original = subTask.isDone;
    setSubTasks((curr) => curr.map((s) => (s.id === subTask.id ? { ...s, isDone: !original } : s)));
    try {
      await client.models.subtask.update({ id: subTask.id, isDone: !original });
    } catch {
      setSubTasks((curr) => curr.map((s) => (s.id === subTask.id ? { ...s, isDone: original } : s)));
    }
  }



  async function deleteSubTask(subTask: Schema["subtask"]["type"]) {
    setSubTasks((curr) => curr.filter((s) => s.id !== subTask.id));
    try {
      await client.models.subtask.delete({ id: subTask.id });
    } catch {
      setSubTasks((curr) => [...curr, subTask]);
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
            <>
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
              {subTasks
                .filter((s) => s.todoId === todo.id)
                .map((s) => (
                  <tr key={s.id}>
                    <td style={{ paddingLeft: "2rem" }}>
                      <label>
                        <input
                          type="checkbox"
                          onChange={() => toggleSubTask(s)}
                        />
                        {s.content}
                      </label>
                    </td>
                    <td></td>
                    <td>
                      <button onClick={() => deleteSubTask(s)}>Delete</button>
                    </td>
                    <td></td>
                  </tr>
                ))}
              <tr key={`${todo.id}-form`}>
                <td style={{ paddingLeft: "2rem" }} colSpan={4}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addSubTask(todo.id);
                    }}
                  >
                    <input
                      placeholder="subtask"
                      value={subTaskInput[todo.id] || ""}
                      onChange={(e) =>
                        setSubTaskInput((curr) => ({ ...curr, [todo.id]: e.target.value }))
                      }
                    />
                    <button type="submit">Add</button>
                  </form>
                </td>
              </tr>
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
