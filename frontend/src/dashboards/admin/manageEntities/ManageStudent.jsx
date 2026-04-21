import React, { useEffect, useState } from "react";
import {
  BASE_URL,
  addNewStudent,
  deleteStudent,
  getAllStudents,
  updateStudent,
  bulkUploadStudents,
} from "../../../http";
import profileImage from "../../../assets/avatar.svg";
import { toast } from "react-hot-toast";
import { FaEdit, FaEye, FaTrash, FaUpload } from "react-icons/fa";
import { Modal, Pagination } from "../../../components";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

const ManageStudent = () => {
  const [query, setQuery] = useState({ email: "", name: "", rollNumber: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState({});
  const [isFirstRender, setIsFirstRender] = useState(true);
  const [showAddNewModel, setShowAddNewModel] = useState(false);
  const [showUpdateModel, setShowUpdateModel] = useState(false);
  const navigate = useNavigate();
  const initialState = {
    _id: "",
    name: "",
    fatherName: "",
    email: "",
    rollNumber: "",
    departement: "",
    batch: "",
    password: "",
  };
  const [formData, setFormData] = useState(initialState);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCloseAddNewModel = () => {
    setShowAddNewModel(false);
    setFormData(initialState);
  };

  const handleCloseUpdateModel = () => {
    setShowUpdateModel(false);
    setFormData(initialState);
  };

  const handleAddNew = (e) => {
    e.preventDefault();
    const promise = addNewStudent({
      name: formData.name,
      fatherName: formData.fatherName,
      email: formData.email,
      rollNumber: formData.rollNumber,
      departement: formData.departement,
      batch: formData.batch,
      password: formData.password,
    });
    toast.promise(promise, {
      loading: "Saving...",
      success: (data) => {
        setFormData(initialState);
        fetchData();
        setShowAddNewModel(false);
        return "Student Added successfully..";
      },
      error: (err) => {
        console.log(err);
        return err?.response?.data?.message || "Something went wrong !";
      },
    });
  };

  const handleDelete = (_id) => {
    const promise = deleteStudent(_id);
    toast.promise(promise, {
      loading: "deleting...",
      success: (data) => {
        fetchData();
        return "Student Deleted successfully..";
      },
      error: (err) => {
        return err?.response?.data?.message || "Something went wrong !";
      },
    });
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    const promise = updateStudent(formData?._id, {
      name: formData.name,
      fatherName: formData.fatherName,
      email: formData.email,
      rollNumber: formData.rollNumber,
      departement: formData.departement,
      batch: formData.batch,
      accountStatus: formData.accountStatus,
    });
    toast.promise(promise, {
      loading: "Updating...",
      success: (data) => {
        setFormData(initialState);
        fetchData();
        setShowUpdateModel(false);
        return "Student Updated successfully..";
      },
      error: (err) => {
        console.log(err);
        return err?.response?.data?.message || "Something went wrong !";
      },
    });
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await getSampleStudents();
      const sampleStudents = response.data.students;

      const worksheet = XLSX.utils.json_to_sheet(sampleStudents);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
      XLSX.writeFile(workbook, "students_sample_10.xlsx");
      toast.success("Sample file downloaded successfully!");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to download template");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast.error("Excel file is empty");
          return;
        }

        const requiredFields = ["name", "fatherName", "email", "rollNumber", "departement", "batch", "password"];
        const missingFields = requiredFields.filter(field => !(field in jsonData[0]));
        
        if (missingFields.length > 0) {
          toast.error(`Missing columns: ${missingFields.join(", ")}`);
          return;
        }

        const promise = bulkUploadStudents({ students: jsonData });
        toast.promise(promise, {
          loading: "Uploading students...",
          success: (data) => {
            fetchData();
            
            // Show detailed error messages if there are failures
            if (data.data.errors && data.data.errors.length > 0) {
              const errorMessages = data.data.errors
                .slice(0, 3) // Show first 3 errors
                .map(e => `${e.name || e.rollNumber}: ${e.error}`)
                .join("\n");
              
              setTimeout(() => {
                toast.error(
                  `Failed Students:\n${errorMessages}${data.data.errors.length > 3 ? `\n... and ${data.data.errors.length - 3} more` : ""}`,
                  { duration: 5000 }
                );
              }, 1000);
            }
            
            return `✅ ${data.data.successful} students added, ❌ ${data.data.failed} failed`;
          },
          error: (err) => {
            return err?.response?.data?.message || "Upload failed";
          },
        });
      } catch (error) {
        toast.error("Error reading Excel file");
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const fetchData = async () => {
    try {
      const { data } = await getAllStudents(
        query.email,
        query.name,
        query.rollNumber,
        currentPage
      );
      setData(data);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }
    setCurrentPage(1);
    // debouncing
    const handler = setTimeout(() => {
      fetchData();
    }, 1000);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  useEffect(() => {
    fetchData();
  }, [currentPage]);

  return (
    <div className="manage__section bg">
      <div className="header">
        <h2>Manage Students</h2>
        <div>
          <button
            className="btn btn__secondary"
            onClick={() => {
              setShowAddNewModel(true);
            }}
          >
            Add New
          </button>
          <label className="btn btn__primary" style={{ cursor: "pointer", marginLeft: "10px" }}>
            <FaUpload style={{ marginRight: "5px" }} />
            Upload Excel
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>

      <div className="filter">
        <input
          type="text"
          placeholder="Search by roll number...."
          className="background__accent text"
          value={query.rollNumber}
          onChange={(e) => {
            setQuery({ ...query, rollNumber: e.target.value });
          }}
        />
        <input
          type="text"
          placeholder="Search by name...."
          className="background__accent text"
          value={query.name}
          onChange={(e) => {
            setQuery({ ...query, name: e.target.value });
          }}
        />
        <input
          type="text"
          placeholder="Search by email...."
          className="background__accent text"
          value={query.email}
          onChange={(e) => {
            setQuery({ ...query, email: e.target.value });
          }}
        />
        <button
          className="btn btn__primary"
          onClick={() => {
            setQuery({ email: "", name: "", rollNumber: "" });
          }}
        >
          CLEAR
        </button>
      </div>

      <div className="table__wrapper" style={{ overflow: "auto" }}>
        <table className="background__accent" cellSpacing="0" cellPadding="0">
          <thead className="bg__secondary">
            <tr>
              <td>Roll Number</td>
              <td>Image</td>
              <td>Name</td>
              <td>Father Name</td>
              <td>Email</td>
              <td>Actions</td>
            </tr>
          </thead>
          <tbody>
            {data?.students?.map((i) => {
              return (
                <tr key={i._id}>
                  <td>{i.rollNumber}</td>
                  <td>
                    <img
                      src={
                        i.imagePath
                          ? `${BASE_URL}/${i.imagePath}`
                          : profileImage
                      }
                      alt="avatar"
                      className="avatar"
                    />
                  </td>
                  <td>{i.name}</td>
                  <td>{i.fatherName}</td>
                  <td>{i.email}</td>
                  <td>
                    <div className="actions">
                      <button
                        onClick={() => {
                          navigate(`/admin/dashboard/user-details/${i._id}`);
                        }}
                        className="btn btn__success"
                      >
                        <FaEye />
                      </button>
                      <button
                        className="btn btn__warning"
                        onClick={() => {
                          setFormData({
                            _id: i._id,
                            name: i.name,
                            fatherName: i.fatherName,
                            email: i.email,
                            rollNumber: i.rollNumber,
                            batch: i.batch._id,
                            departement: i.departement._id,
                          });
                          setShowUpdateModel(true);
                        }}
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn btn__danger"
                        onClick={() => {
                          handleDelete(i._id);
                        }}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        data={data}
      />

      {/* ADD NEW Batch FORM */}
      <Modal
        title="ADD NEW STUDENT"
        show={showAddNewModel}
        onClose={handleCloseAddNewModel}
      >
        <form onSubmit={handleAddNew}>
          <div className="form-control">
            <label htmlFor="name">Student Name</label>
            <input
              type="text"
              placeholder="Enter student name"
              name="name"
              className="bg text__color"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-control">
            <label htmlFor="fatherName">Father Name</label>
            <input
              type="text"
              placeholder="Enter father name"
              name="fatherName"
              className="bg text__color"
              value={formData.fatherName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label htmlFor="fatherName">Roll Number</label>
            <input
              type="text"
              placeholder="Enter roll number"
              name="rollNumber"
              className="bg text__color"
              value={formData.rollNumber}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              placeholder="Enter email"
              name="email"
              className="bg text__color"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              placeholder="Enter password (min 6 characters)"
              name="password"
              className="bg text__color"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          <div className="form-control">
            <label htmlFor="batch">Batch</label>
            <select
              name="batch"
              id="batch"
              className="bg text__color"
              value={formData.batch}
              onChange={handleChange}
              required
            >
              <option value="">Select Batch</option>
              {data?.batches?.map((batch) => {
                return (
                  <option key={batch._id} value={batch._id}>
                    {batch.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-control">
            <label htmlFor="departementAdd">Departement</label>
            <select
              name="departement"
              id="departementAdd"
              className="bg text__color"
              value={formData.departement}
              onChange={handleChange}
              required
            >
              <option value="">Select Departement</option>
              {data?.departements?.map((departement) => {
                return (
                  <option key={departement._id} value={departement._id}>
                    {departement.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="actions">
            <button
              className="btn btn__danger"
              type="button"
              onClick={handleCloseAddNewModel}
            >
              CANCEL
            </button>
            <button type="submit" className="btn btn__success">
              SUBMIT
            </button>
          </div>
        </form>
      </Modal>

      {/* UPDATE ALMIRAH FORM */}
      <Modal
        title="UPDATE STUDENT"
        show={showUpdateModel}
        onClose={handleCloseUpdateModel}
      >
        <form onSubmit={handleUpdate}>
          <div className="form-control">
            <label htmlFor="name">Student Name</label>
            <input
              type="text"
              placeholder="Enter student name"
              name="name"
              className="bg text__color"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-control">
            <label htmlFor="fatherName">Father Name</label>
            <input
              type="text"
              placeholder="Enter father name"
              name="fatherName"
              className="bg text__color"
              value={formData.fatherName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label htmlFor="fatherName">Roll Number</label>
            <input
              type="text"
              placeholder="Enter roll number"
              name="rollNumber"
              className="bg text__color"
              value={formData.rollNumber}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              placeholder="Enter email"
              name="email"
              className="bg text__color"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label htmlFor="batch">Batch</label>
            <select
              name="batch"
              id="batch"
              className="bg text__color"
              value={formData.batch}
              onChange={handleChange}
              required
            >
              <option value="">Select Batch</option>
              {data?.batches?.map((batch) => {
                return (
                  <option key={batch._id} value={batch._id}>
                    {batch.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-control">
            <label htmlFor="departementUpdate">Departement</label>
            <select
              name="departement"
              id="departementUpdate"
              className="bg text__color"
              value={formData.departement}
              onChange={handleChange}
              required
            >
              <option value="">Select Departement</option>
              {data?.departements?.map((departement) => {
                return (
                  <option key={departement._id} value={departement._id}>
                    {departement.name}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="actions">
            <button
              className="btn btn__danger"
              type="button"
              onClick={handleCloseUpdateModel}
            >
              CANCEL
            </button>
            <button type="submit" className="btn btn__success">
              UPDATE
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ManageStudent;
