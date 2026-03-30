import { ErrorBoundary } from "react-error-boundary";
import { Provider } from "react-redux";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import Chat from "./pages";
import { AppErrorFallback, RouteErrorFallback, captureComponentStack } from "./pages/components/ErrorFallback";
import RootWrapper from "./pages/RootWrapper";
import { MCPDetails } from "./pages/settings/MCPDetails";
import { Settings } from "./pages/settings/Settings";
import { store } from "./redux/store";

export const ROUTES = {
    CHAT: "/",
    MCP_DETAILS: "/mcp-details",
    SETTINGS: "/settings",
};

const router = createMemoryRouter([
    {
        path: ROUTES.CHAT,
        element: <RootWrapper />,
        errorElement: <RouteErrorFallback />,
        children: [
            {
                path: "/index.html",
                element: <Chat />,
            },
            {
                path: ROUTES.CHAT,
                element: <Chat />,
            },
            {
                path: ROUTES.MCP_DETAILS,
                element: <MCPDetails />,
            },
            {
                path: ROUTES.SETTINGS,
                element: <Settings />,
            },
        ],
    },
]);

function App() {
    return (
        <Provider store={store}>
            <ErrorBoundary FallbackComponent={AppErrorFallback} onError={captureComponentStack}>
                <RouterProvider router={router} />
            </ErrorBoundary>
        </Provider>
    );
}

export default App
